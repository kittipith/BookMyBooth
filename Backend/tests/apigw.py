import json
from dataclasses import dataclass
from typing import Any


@dataclass
class FakeLambdaContext:
    function_name: str = "test"
    memory_limit_in_mb: int = 256
    invoked_function_arn: str = "arn:aws:lambda:us-east-1:123456789012:function:test"
    aws_request_id: str = "test-request"


def http_event(
    method: str,
    path: str,
    body: Any = None,
    claims: dict[str, Any] | None = None,
    query: dict[str, str] | None = None,
) -> dict:
    """event ของ API Gateway HTTP API (payload 2.0) ส่ง claims เพื่อจำลองผ่าน JWT authorizer"""
    request_context: dict[str, Any] = {
        "http": {"method": method, "path": path, "protocol": "HTTP/1.1", "sourceIp": "127.0.0.1"},
        "routeKey": f"{method} {path}",
        "stage": "$default",
        "requestId": "test-request",
    }
    if claims is not None:
        request_context["authorizer"] = {"jwt": {"claims": claims, "scopes": None}}
    return {
        "version": "2.0",
        "routeKey": f"{method} {path}",
        "rawPath": path,
        "rawQueryString": "&".join(f"{k}={v}" for k, v in (query or {}).items()),
        "queryStringParameters": query,
        "headers": {"content-type": "application/json"},
        "requestContext": request_context,
        "body": body if body is None or isinstance(body, str) else json.dumps(body),
        "isBase64Encoded": False,
    }


def parse(response: dict) -> tuple[int, Any]:
    return response["statusCode"], json.loads(response["body"]) if response.get("body") else None
