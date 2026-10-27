import json
from decimal import Decimal
from typing import Any

from aws_lambda_powertools import Logger
from aws_lambda_powertools.event_handler import APIGatewayHttpResolver, Response, content_types
from aws_lambda_powertools.event_handler.exceptions import NotFoundError
from botocore.exceptions import ClientError
from pydantic import ValidationError

from shared.errors import AppError

logger = Logger()

# ClientError ที่หมายถึง "สถานะชน" ส่วนที่ต้องการ code เฉพาะ ให้ domain จับเองแล้ว raise AppError
_CONFLICT_CODES = {"ConditionalCheckFailedException", "TransactionCanceledException"}


def _default(value: Any) -> Any:
    # boto3 คืนตัวเลขจาก DynamoDB เป็น Decimal
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, set):
        return sorted(value)
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def to_json(data: Any) -> str:
    return json.dumps(data, default=_default, ensure_ascii=False, separators=(",", ":"))


def error_response(status: int, code: str, message: str, details: Any = None) -> Response:
    error: dict[str, Any] = {"code": code, "message": message}
    if details is not None:
        error["details"] = details
    return Response(
        status_code=status,
        content_type=content_types.APPLICATION_JSON,
        body=to_json({"error": error}),
    )


def create_app() -> APIGatewayHttpResolver:
    """router ของทุก function: แปลง Decimal ตอนส่ง JSON และแปลง exception เป็น error response"""
    app = APIGatewayHttpResolver(serializer=to_json)

    @app.exception_handler(AppError)
    def handle_app_error(e: AppError) -> Response:
        return error_response(e.status, e.code, e.message, e.details)

    @app.exception_handler(ValidationError)
    def handle_validation_error(e: ValidationError) -> Response:
        details = [
            {"field": ".".join(str(p) for p in err["loc"]), "message": err["msg"]}
            for err in e.errors(include_url=False, include_context=False, include_input=False)
        ]
        return error_response(400, "VALIDATION_ERROR", "ข้อมูลไม่ถูกต้อง", details)

    @app.exception_handler(ClientError)
    def handle_client_error(e: ClientError) -> Response:
        if e.response.get("Error", {}).get("Code") in _CONFLICT_CODES:
            return error_response(409, "CONFLICT", "ข้อมูลถูกเปลี่ยนไปแล้ว กรุณาลองใหม่")
        logger.exception("AWS call failed")
        return error_response(500, "INTERNAL_ERROR", "เกิดข้อผิดพลาดในระบบ")

    @app.exception_handler(json.JSONDecodeError)
    def handle_bad_json(_: json.JSONDecodeError) -> Response:
        return error_response(400, "INVALID_JSON", "รูปแบบ JSON ไม่ถูกต้อง")

    @app.not_found
    def handle_not_found(_: NotFoundError) -> Response:
        return error_response(404, "ROUTE_NOT_FOUND", "ไม่พบ API นี้")

    @app.exception_handler(Exception)
    def handle_unexpected(_: Exception) -> Response:
        logger.exception("Unhandled error")
        return error_response(500, "INTERNAL_ERROR", "เกิดข้อผิดพลาดในระบบ")

    return app
