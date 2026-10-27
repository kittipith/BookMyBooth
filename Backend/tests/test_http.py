import json
from decimal import Decimal

import pytest
from botocore.exceptions import ClientError
from pydantic import BaseModel

from apigw import FakeLambdaContext, http_event, parse
from shared.errors import conflict, not_found
from shared.http import create_app, to_json


class _Body(BaseModel):
    name: str
    price: int


@pytest.fixture
def app():
    app = create_app()

    @app.get("/decimal")
    def decimal_route():
        return {"price": Decimal("150"), "ratio": Decimal("0.5")}

    @app.post("/items")
    def create_item():
        body = _Body.model_validate(app.current_event.json_body)
        return body.model_dump(), 201

    @app.get("/items/<item_id>")
    def get_item(item_id: str):
        raise not_found(f"ไม่พบ {item_id}")

    @app.post("/conflict")
    def app_conflict():
        raise conflict("ล็อกนี้มีผู้จองแล้ว", "LOT_NOT_AVAILABLE", {"lotIds": ["A01"]})

    @app.post("/dynamo-conflict")
    def dynamo_conflict():
        raise ClientError(
            {"Error": {"Code": "ConditionalCheckFailedException", "Message": "x"}}, "PutItem"
        )

    @app.get("/boom")
    def boom():
        raise RuntimeError("unexpected")

    return app


def call(app, *args, **kwargs):
    return parse(app.resolve(http_event(*args, **kwargs), FakeLambdaContext()))


def test_to_json_converts_decimal_and_keeps_thai():
    assert json.loads(to_json({"a": Decimal("3"), "b": Decimal("1.5")})) == {"a": 3, "b": 1.5}
    assert "ล็อก" in to_json({"m": "ล็อก"})


def test_decimal_response(app):
    status, body = call(app, "GET", "/decimal")
    assert status == 200
    assert body == {"price": 150, "ratio": 0.5}


def test_created(app):
    status, body = call(app, "POST", "/items", {"name": "A", "price": 100})
    assert status == 201
    assert body == {"name": "A", "price": 100}


def test_validation_error(app):
    status, body = call(app, "POST", "/items", {"name": "A"})
    assert status == 400
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert body["error"]["details"][0]["field"] == "price"


def test_invalid_json(app):
    status, body = call(app, "POST", "/items", "{not json")
    assert status == 400
    assert body["error"]["code"] == "INVALID_JSON"


def test_app_error(app):
    status, body = call(app, "GET", "/items/x1")
    assert status == 404
    assert body == {"error": {"code": "NOT_FOUND", "message": "ไม่พบ x1"}}


def test_app_error_with_details(app):
    status, body = call(app, "POST", "/conflict")
    assert status == 409
    assert body["error"]["details"] == {"lotIds": ["A01"]}


def test_dynamodb_condition_failure_is_conflict(app):
    status, body = call(app, "POST", "/dynamo-conflict")
    assert status == 409
    assert body["error"]["code"] == "CONFLICT"


def test_unknown_route(app):
    status, body = call(app, "GET", "/nope")
    assert status == 404
    assert body["error"]["code"] == "ROUTE_NOT_FOUND"


def test_unexpected_error_hides_details(app):
    status, body = call(app, "GET", "/boom")
    assert status == 500
    assert body["error"]["code"] == "INTERNAL_ERROR"
    assert "unexpected" not in json.dumps(body)
