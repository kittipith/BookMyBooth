"""API จำลองในเครื่องสำหรับเชื่อม frontend ก่อนขึ้น AWS (INTEGRATION-PLAN หัวข้อ 4)

รัน lambda_handler จริงจาก src/ โดยชี้ boto3 ทุกตัวไปที่ moto server (AWS จำลอง) แทน AWS
ทำหน้าที่แทน API Gateway: เลือก Lambda ตาม route, ตรวจ token แบบ dev, ใส่ CORS
ข้อมูลอยู่ในหน่วยความจำ ปิดแล้วหาย เปิดใหม่ได้บัญชีเดโมและ demo-event ชุดเดิม

    python scripts/local_api.py            # http://localhost:3001

ล็อกอินด้วย POST /_dev/sign-in แล้วส่ง `Authorization: Bearer dev.<userId>` ทุก request
ไฟล์นี้ไม่อยู่ใน lambda.zip (build_zip.py ใส่แค่ src/) จึงไม่มีทางขึ้น AWS
"""

import argparse
import base64
import json
import logging
import os
import re
import sys
import threading
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "src"), str(ROOT / "tests"), str(ROOT / "scripts")]

STAGE = "local"
REGION = "us-east-1"
DEFAULT_PORT = 3001
DEFAULT_MOTO_PORT = 5000
DEMO_PASSWORD = "Passw0rd!"
CORS_ORIGINS = ("http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4173")

# ตั้งก่อน import โค้ดใน src ให้ boto3 ไม่ไปหา AWS จริง (ค่า endpoint ตั้งใน configure())
os.environ.update(
    {
        "AWS_ACCESS_KEY_ID": "local",
        "AWS_SECRET_ACCESS_KEY": "local",
        "AWS_DEFAULT_REGION": REGION,
        "POWERTOOLS_SERVICE_NAME": "bookmybooth-local",
        "POWERTOOLS_LOG_LEVEL": os.environ.get("POWERTOOLS_LOG_LEVEL", "WARNING"),
        "FILES_BUCKET": f"bookmybooth-{STAGE}-files",
        "EXPIRE_FUNCTION_ARN": f"arn:aws:lambda:{REGION}:123456789012:function:expire-booking",
        "SCHEDULER_ROLE_ARN": "arn:aws:iam::123456789012:role/LabRole",
    }
)
os.environ.pop("AWS_SESSION_TOKEN", None)
os.environ.pop("AWS_PROFILE", None)

import boto3  # noqa: E402
from botocore.exceptions import ClientError  # noqa: E402

from domain import users  # noqa: E402
from functions.admin import app as admin_fn  # noqa: E402
from functions.bookings import app as bookings_fn  # noqa: E402
from functions.events import app as events_fn  # noqa: E402
from functions.expire_booking import app as expire_fn  # noqa: E402
from functions.me import app as me_fn  # noqa: E402
from functions.post_confirmation import app as post_confirmation_fn  # noqa: E402
from seed import DEMO_ACCOUNTS, seed_accounts, seed_event  # noqa: E402
from shared import clock, cognito, db, s3, scheduler  # noqa: E402
from tables import TABLES  # noqa: E402


@dataclass
class LambdaContext:
    function_name: str
    memory_limit_in_mb: int = 256
    invoked_function_arn: str = f"arn:aws:lambda:{REGION}:123456789012:function:local"
    aws_request_id: str = "local-request"


@dataclass(frozen=True)
class Route:
    method: str
    template: str
    handler: Any
    public: bool = False

    @property
    def pattern(self) -> re.Pattern[str]:
        return re.compile("^" + re.sub(r"\{(\w+)\}", r"(?P<\1>[^/]+)", self.template) + "$")


# ตรงกับ AWS-SETUP ข้อ 6.1 ทุก route (ถ้าเพิ่ม route ที่นั่น ต้องเพิ่มที่นี่ด้วย)
_EVENTS = events_fn.lambda_handler
_BOOKINGS = bookings_fn.lambda_handler
_ADMIN = admin_fn.lambda_handler
_ME = me_fn.lambda_handler
ROUTES = (
    Route("GET", "/health", _EVENTS, public=True),
    Route("GET", "/events", _EVENTS, public=True),
    Route("GET", "/events/{eventId}", _EVENTS, public=True),
    Route("GET", "/events/{eventId}/lots", _EVENTS, public=True),
    Route("POST", "/events", _EVENTS),
    Route("PUT", "/events/{eventId}", _EVENTS),
    Route("POST", "/events/{eventId}/close", _EVENTS),
    Route("PUT", "/events/{eventId}/lots", _EVENTS),
    Route("GET", "/events/{eventId}/summary", _EVENTS),
    Route("GET", "/organizer/events", _EVENTS),
    Route("GET", "/events/{eventId}/bookings", _BOOKINGS),
    Route("GET", "/organizer/vendors", _BOOKINGS),
    Route("POST", "/bookings", _BOOKINGS),
    Route("GET", "/bookings/me", _BOOKINGS),
    Route("POST", "/bookings/{bookingId}/slip-url", _BOOKINGS),
    Route("POST", "/bookings/{bookingId}/slip", _BOOKINGS),
    Route("GET", "/bookings/{bookingId}/slip", _BOOKINGS),
    Route("POST", "/bookings/{bookingId}/cancel", _BOOKINGS),
    Route("POST", "/bookings/{bookingId}/approve", _BOOKINGS),
    Route("POST", "/bookings/{bookingId}/reject", _BOOKINGS),
    Route("POST", "/bookings/{bookingId}/check-in", _BOOKINGS),
    Route("GET", "/admin/organizers", _ADMIN),
    Route("POST", "/admin/organizers/{userId}/approve", _ADMIN),
    Route("POST", "/admin/organizers/{userId}/reject", _ADMIN),
    Route("POST", "/admin/users/{userId}/suspend", _ADMIN),
    Route("POST", "/admin/users/{userId}/unsuspend", _ADMIN),
    Route("GET", "/admin/events", _ADMIN),
    Route("GET", "/admin/users", _ADMIN),
    Route("GET", "/me", _ME),
    Route("PUT", "/me", _ME),
    Route("GET", "/notifications", _ME),
    Route("POST", "/notifications/read", _ME),
)

TOKEN_PREFIX = "dev."

# app ของ Powertools เก็บ request ปัจจุบันไว้ใน global จึงเรียก handler ทีละ request
_lambda_lock = threading.Lock()


class LocalAws:
    """moto server + ตาราง/bucket/user pool ตาม tests/tables.py และ AWS-SETUP ข้อ 2–4"""

    def __init__(self, moto_port: int):
        from moto.server import ThreadedMotoServer

        # moto ใช้ werkzeug ที่ log ทุก request ปิดไว้ให้เห็นแค่ log ของ API
        logging.getLogger("werkzeug").setLevel(logging.ERROR)
        self.server = ThreadedMotoServer(ip_address="127.0.0.1", port=moto_port, verbose=False)
        self.endpoint = f"http://127.0.0.1:{moto_port}"
        self.pool_id = ""
        self.client_id = ""

    def start(self) -> None:
        self.server.start()
        os.environ["AWS_ENDPOINT_URL"] = self.endpoint
        for env in TABLES:
            os.environ[env] = f"bookmybooth-{STAGE}-{env.removesuffix('_TABLE').lower()}"
        # ให้ client ที่ cache ไว้สร้างใหม่ด้วย endpoint ของ moto
        db.reset_clients()
        for module in (cognito, s3, scheduler):
            module.client.cache_clear()
        self._create_resources()

    def stop(self) -> None:
        self.server.stop()

    def _create_resources(self) -> None:
        dynamodb = boto3.client("dynamodb")
        for env, definition in TABLES.items():
            dynamodb.create_table(TableName=os.environ[env], **definition)

        bucket = os.environ["FILES_BUCKET"]
        boto3.client("s3").create_bucket(Bucket=bucket)
        boto3.client("s3").put_bucket_cors(
            Bucket=bucket,
            CORSConfiguration={
                "CORSRules": [
                    {
                        "AllowedMethods": ["GET", "POST"],
                        "AllowedOrigins": list(CORS_ORIGINS),
                        "AllowedHeaders": ["*"],
                        "MaxAgeSeconds": 3000,
                    }
                ]
            },
        )

        idp = boto3.client("cognito-idp")
        self.pool_id = idp.create_user_pool(
            PoolName=f"bookmybooth-{STAGE}",
            UsernameAttributes=["email"],
            Policies={
                "PasswordPolicy": {
                    "MinimumLength": 8,
                    "RequireLowercase": True,
                    "RequireNumbers": True,
                    "RequireUppercase": False,
                    "RequireSymbols": False,
                }
            },
            Schema=[{"Name": "role", "AttributeDataType": "String", "Mutable": True}],
        )["UserPool"]["Id"]
        self.client_id = idp.create_user_pool_client(
            UserPoolId=self.pool_id,
            ClientName="local",
            ExplicitAuthFlows=["ALLOW_ADMIN_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"],
        )["UserPoolClient"]["ClientId"]
        for precedence, group in zip((30, 20, 10), ("Seller", "Organizer", "Admin"), strict=True):
            idp.create_group(UserPoolId=self.pool_id, GroupName=group, Precedence=precedence)
        os.environ["USER_POOL_ID"] = self.pool_id

    def seed(self) -> list[dict]:
        seeded = seed_accounts(
            cognito=boto3.client("cognito-idp"),
            users_table=db.table("users"),
            pool_id=self.pool_id,
            password=DEMO_PASSWORD,
        )
        organizer = next(item for item in seeded if item["role"] == users.ORGANIZER)
        seed_event(
            events_table=db.table("events"),
            lots_table=db.table("lots"),
            organizer=organizer,
            now=clock.now(),
        )
        return seeded


class DevError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


class LocalApi:
    """แปลง HTTP request เป็น event ของ API Gateway HTTP API (payload 2.0) แล้วเรียก Lambda"""

    def __init__(self, local_aws: LocalAws):
        self.aws = local_aws

    # ---------- เหมือน API Gateway ----------

    def match(self, method: str, path: str) -> tuple[Route, dict[str, str]] | None:
        for route in ROUTES:
            found = route.pattern.match(path)
            if route.method == method and found:
                return route, found.groupdict()
        return None

    def claims_for(self, authorization: str | None) -> dict[str, Any] | None:
        """แทน JWT authorizer: Bearer dev.<userId> → {sub, cognito:groups} ไม่ถูกต้อง → None"""
        if not authorization or not authorization.startswith("Bearer " + TOKEN_PREFIX):
            return None
        user_id = authorization.removeprefix("Bearer " + TOKEN_PREFIX).strip()
        if not user_id:
            return None
        claims: dict[str, Any] = {"sub": user_id}
        record = db.table("users").get_item(Key={"userId": user_id}).get("Item")
        if record is not None:
            # อ่าน group จาก Cognito จำลองทุก request group ใหม่จึงมีผลทันที (บน AWS ต้อง refresh token)
            response = boto3.client("cognito-idp").admin_list_groups_for_user(
                UserPoolId=self.aws.pool_id, Username=users.cognito_username(record)
            )
            groups = [group["GroupName"] for group in response["Groups"]]
            if groups:
                # HTTP API ส่ง groups เป็น string แบบนี้ (shared/auth.parse_groups)
                claims["cognito:groups"] = "[" + " ".join(groups) + "]"
        return claims

    def invoke(
        self,
        method: str,
        raw_path: str,
        query: str,
        headers: dict[str, str],
        body: bytes,
    ) -> tuple[int, dict[str, str], bytes]:
        matched = self.match(method, raw_path)
        if matched is None:
            # ข้อความเดียวกับ API Gateway เมื่อไม่มี route
            return 404, {"content-type": "application/json"}, b'{"message":"Not Found"}'
        route, path_params = matched

        claims = None
        if not route.public:
            claims = self.claims_for(headers.get("authorization"))
            if claims is None:
                return 401, {"content-type": "application/json"}, b'{"message":"Unauthorized"}'

        event = _http_event(route, raw_path, query, path_params, headers, body, claims)
        context = LambdaContext(function_name=route.handler.__module__)
        with _lambda_lock:
            response = route.handler(event, context)

        payload = response.get("body") or ""
        data = base64.b64decode(payload) if response.get("isBase64Encoded") else payload.encode()
        out_headers = {
            key.lower(): str(value) for key, value in response.get("headers", {}).items()
        }
        return response["statusCode"], out_headers, data

    # ---------- /_dev/* (ไม่มีบน AWS) ----------

    def dev(self, method: str, path: str, body: dict[str, Any]) -> tuple[int, Any]:
        routes = {
            ("GET", "/_dev/accounts"): self.dev_accounts,
            ("POST", "/_dev/sign-up"): self.dev_sign_up,
            ("POST", "/_dev/confirm"): self.dev_confirm,
            ("POST", "/_dev/sign-in"): self.dev_sign_in,
            ("POST", "/_dev/reset-password"): self.dev_reset_password,
            ("POST", "/_dev/expire"): self.dev_expire,
        }
        action = routes.get((method, path))
        if action is None:
            raise DevError(404, "ROUTE_NOT_FOUND", "ไม่พบ API นี้")
        return action(body)

    def dev_accounts(self, _: dict[str, Any]) -> tuple[int, Any]:
        items = []
        for account in DEMO_ACCOUNTS:
            record = self._user_by_email(account.email)
            items.append(
                {
                    "email": account.email,
                    "password": DEMO_PASSWORD,
                    "role": account.role,
                    "userId": record["userId"] if record else None,
                }
            )
        return 200, {"items": items}

    def dev_sign_up(self, body: dict[str, Any]) -> tuple[int, Any]:
        """เหมือน Amplify signUp: สร้างผู้ใช้ UNCONFIRMED พร้อม custom:role"""
        email, password = _required(body, "email"), _required(body, "password")
        role = str(body.get("role") or "seller").lower()
        try:
            response = boto3.client("cognito-idp").sign_up(
                ClientId=self.aws.client_id,
                Username=email,
                Password=password,
                UserAttributes=[
                    {"Name": "email", "Value": email},
                    {"Name": "custom:role", "Value": role},
                ],
            )
        except ClientError as error:
            raise _cognito_error(error) from error
        return 200, {"userId": response["UserSub"], "userConfirmed": False}

    def dev_confirm(self, body: dict[str, Any]) -> tuple[int, Any]:
        """เหมือน confirmSignUp: ไม่ตรวจ code แล้วรัน PostConfirmation trigger จริงด้วย clientMetadata"""
        email = _required(body, "email")
        idp = boto3.client("cognito-idp")
        try:
            user = idp.admin_get_user(UserPoolId=self.aws.pool_id, Username=email)
            if user["UserStatus"] == "CONFIRMED":
                raise DevError(400, "NotAuthorizedException", "ยืนยันบัญชีนี้ไปแล้ว")
            idp.admin_confirm_sign_up(UserPoolId=self.aws.pool_id, Username=email)
        except ClientError as error:
            raise _cognito_error(error) from error

        attributes = {attr["Name"]: attr["Value"] for attr in user["UserAttributes"]}
        profile = body.get("profile") or {}
        trigger_event = {
            "version": "1",
            "region": REGION,
            "userPoolId": self.aws.pool_id,
            "userName": user["Username"],
            "triggerSource": "PostConfirmation_ConfirmSignUp",
            "request": {
                "userAttributes": attributes,
                # Cognito ส่ง clientMetadata เป็น string ทุกค่า
                "clientMetadata": {key: str(value) for key, value in profile.items()},
            },
            "response": {},
        }
        with _lambda_lock:
            post_confirmation_fn.lambda_handler(
                trigger_event, LambdaContext(function_name="post_confirmation")
            )
        return 200, {"userId": attributes["sub"]}

    def dev_sign_in(self, body: dict[str, Any]) -> tuple[int, Any]:
        """ตรวจรหัสผ่านกับ Cognito จำลอง แล้วคืน token dev.<userId>"""
        email, password = _required(body, "email"), _required(body, "password")
        idp = boto3.client("cognito-idp")
        try:
            user = idp.admin_get_user(UserPoolId=self.aws.pool_id, Username=email)
            # moto ตอบบัญชีที่ถูกระงับเป็นรหัสผิดธรรมดา ต้องเช็กก่อนเพื่อให้ได้ข้อความแบบ Cognito
            if not user["Enabled"]:
                raise DevError(400, "NotAuthorizedException", "User is disabled.")
            idp.admin_initiate_auth(
                UserPoolId=self.aws.pool_id,
                ClientId=self.aws.client_id,
                AuthFlow="ADMIN_USER_PASSWORD_AUTH",
                AuthParameters={"USERNAME": email, "PASSWORD": password},
            )
        except ClientError as error:
            raise _cognito_error(error) from error
        # moto ไม่กันบัญชีที่ยังไม่ยืนยันอีเมลเหมือน Cognito จริง
        if user["UserStatus"] != "CONFIRMED":
            code = "UserNotConfirmedException"
            raise DevError(400, code, _COGNITO_MESSAGES[code])
        user_id = next(attr["Value"] for attr in user["UserAttributes"] if attr["Name"] == "sub")
        return 200, {"accessToken": TOKEN_PREFIX + user_id, "userId": user_id}

    def dev_reset_password(self, body: dict[str, Any]) -> tuple[int, Any]:
        """เหมือน confirmResetPassword แต่ไม่ตรวจ code ไม่มีผู้ใช้นี้ก็ตอบสำเร็จ (ไม่บอกว่ามีอีเมลนี้ไหม)"""
        email, password = _required(body, "email"), _required(body, "newPassword")
        try:
            boto3.client("cognito-idp").admin_set_user_password(
                UserPoolId=self.aws.pool_id, Username=email, Password=password, Permanent=True
            )
        except ClientError as error:
            code = error.response.get("Error", {}).get("Code")
            if code != "UserNotFoundException":
                raise _cognito_error(error) from error
        return 200, {}

    def dev_expire(self, _: dict[str, Any]) -> tuple[int, Any]:
        """รัน expire_booking โหมดกวาด (แทน EventBridge Scheduler)"""
        with _lambda_lock:
            result = expire_fn.lambda_handler({}, LambdaContext(function_name="expire_booking"))
        return 200, result

    def _user_by_email(self, email: str) -> dict[str, Any] | None:
        found = [item for item in db.scan_all("users") if item.get("email") == email]
        return found[0] if found else None


def _required(body: dict[str, Any], key: str) -> str:
    value = body.get(key)
    if not isinstance(value, str) or not value.strip():
        raise DevError(400, "VALIDATION_ERROR", f"ต้องส่ง {key}")
    return value.strip()


# ข้อความของ error ที่หน้าเว็บเจอบ่อย (moto ให้ข้อความไม่ตรงกับ Cognito จริง)
_COGNITO_MESSAGES = {
    "NotAuthorizedException": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    "UsernameExistsException": "อีเมลนี้ถูกใช้สมัครแล้ว",
    "UserNotConfirmedException": "ยังไม่ได้ยืนยันอีเมล",
    "InvalidPasswordException": "รหัสผ่านต้องยาวอย่างน้อย 8 ตัว มีตัวพิมพ์เล็กและตัวเลข",
}


def _cognito_error(error: ClientError) -> DevError:
    """ใช้ชื่อ error ของ Cognito เป็น code ให้ frontend จัดการแบบเดียวกับ Amplify"""
    info = error.response.get("Error", {})
    code = info.get("Code", "CognitoError")
    # pool จริงเปิด Prevent user existence errors ไม่บอกว่าไม่มีผู้ใช้นี้
    if code == "UserNotFoundException":
        code = "NotAuthorizedException"
    return DevError(400, code, _COGNITO_MESSAGES.get(code, info.get("Message", code)))


def _http_event(
    route: Route,
    raw_path: str,
    query: str,
    path_params: dict[str, str],
    headers: dict[str, str],
    body: bytes,
    claims: dict[str, Any] | None,
) -> dict[str, Any]:
    # API Gateway รวมค่า query ที่ซ้ำกันด้วยจุลภาค
    params = {key: ",".join(values) for key, values in parse_qs(query).items()}
    request_context: dict[str, Any] = {
        "http": {
            "method": route.method,
            "path": raw_path,
            "protocol": "HTTP/1.1",
            "sourceIp": "127.0.0.1",
            "userAgent": headers.get("user-agent", ""),
        },
        "routeKey": f"{route.method} {route.template}",
        "stage": "$default",
        "requestId": "local-request",
    }
    if claims is not None:
        request_context["authorizer"] = {"jwt": {"claims": claims, "scopes": None}}
    return {
        "version": "2.0",
        "routeKey": f"{route.method} {route.template}",
        "rawPath": raw_path,
        "rawQueryString": query,
        "queryStringParameters": params or None,
        "pathParameters": path_params or None,
        "headers": headers,
        "requestContext": request_context,
        "body": body.decode("utf-8") if body else None,
        "isBase64Encoded": False,
    }


def make_handler(api: LocalApi, cors_origins: tuple[str, ...]) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        server_version = "BookMyBoothLocal/1.0"

        def _cors_headers(self) -> dict[str, str]:
            origin = self.headers.get("Origin")
            if origin not in cors_origins:
                return {}
            return {
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "authorization, content-type",
                "Access-Control-Max-Age": "600",
                "Vary": "Origin",
            }

        def _send(self, status: int, headers: dict[str, str], body: bytes) -> None:
            self.send_response(status)
            for key, value in {**headers, **self._cors_headers()}.items():
                self.send_header(key, value)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _send_json(self, status: int, data: Any) -> None:
            body = json.dumps(data, ensure_ascii=False).encode()
            self._send(status, {"content-type": "application/json"}, body)

        def _handle(self) -> None:
            url = urlsplit(self.path)
            length = int(self.headers.get("Content-Length") or 0)
            body = self.rfile.read(length) if length else b""
            try:
                if url.path.startswith("/_dev/"):
                    data = json.loads(body) if body else {}
                    status, result = api.dev(self.command, url.path, data)
                    self._send_json(status, result)
                    return
                headers = {key.lower(): value for key, value in self.headers.items()}
                self._send(*api.invoke(self.command, url.path, url.query, headers, body))
            except DevError as error:
                self._send_json(
                    error.status, {"error": {"code": error.code, "message": error.message}}
                )
            except json.JSONDecodeError:
                self._send_json(
                    400, {"error": {"code": "INVALID_JSON", "message": "รูปแบบ JSON ไม่ถูกต้อง"}}
                )

        def do_OPTIONS(self) -> None:  # noqa: N802
            self._send(204, {}, b"")

        do_GET = do_POST = do_PUT = do_DELETE = _handle  # noqa: N815

        def log_message(self, format: str, *args: Any) -> None:  # noqa: A002
            sys.stderr.write(f"{self.command} {self.path} → {args[1] if len(args) > 1 else ''}\n")

    return Handler


def create_server(
    *, port: int, moto_port: int, cors_origins: tuple[str, ...] = CORS_ORIGINS
) -> tuple[ThreadingHTTPServer, LocalAws]:
    """เปิด moto + สร้าง resource + seed แล้วคืนเซิร์ฟเวอร์ที่ยังไม่ได้ serve"""
    local_aws = LocalAws(moto_port)
    local_aws.start()
    local_aws.seed()
    server = ThreadingHTTPServer(
        ("127.0.0.1", port), make_handler(LocalApi(local_aws), cors_origins)
    )
    return server, local_aws


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--moto-port", type=int, default=DEFAULT_MOTO_PORT)
    args = parser.parse_args()
    # console ของ Windows อาจไม่ใช่ UTF-8
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8")

    server, local_aws = create_server(port=args.port, moto_port=args.moto_port)
    print(f"BookMyBooth local API  http://localhost:{args.port}")
    print(f"AWS จำลอง (moto)       {local_aws.endpoint}")
    print(f"บัญชีเดโม (รหัสผ่าน {DEMO_PASSWORD}):")
    for account in DEMO_ACCOUNTS:
        print(f"  {account.role:<10} {account.email}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        local_aws.stop()


if __name__ == "__main__":
    main()
