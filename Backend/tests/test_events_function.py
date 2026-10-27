from apigw import FakeLambdaContext, http_event, parse
from functions.events.app import lambda_handler


def test_health():
    status, body = parse(lambda_handler(http_event("GET", "/health"), FakeLambdaContext()))
    assert status == 200
    assert body == {"status": "ok"}
