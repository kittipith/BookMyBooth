"""เปิด scripts/local_api.py เป็น process แยก แล้วเรียกผ่าน HTTP เหมือนหน้าเว็บ

รันแยก process เพราะ local_api ตั้ง env และชี้ boto3 ไปที่ moto server ซึ่งชนกับ mock_aws ของเทสต์อื่น
"""

import os
import socket
import subprocess
import sys
import time
from pathlib import Path

import pytest
import requests

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "local_api.py"
ORIGIN = "http://localhost:5173"
PASSWORD = "Passw0rd!"


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


@pytest.fixture(scope="module")
def base_url():
    port = _free_port()
    process = subprocess.Popen(
        [sys.executable, str(SCRIPT), "--port", str(port), "--moto-port", str(_free_port())],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        env={**os.environ, "PYTHONIOENCODING": "utf-8"},
    )
    url = f"http://127.0.0.1:{port}"
    try:
        deadline = time.monotonic() + 60
        while True:
            try:
                requests.get(f"{url}/health", timeout=1)
                break
            except requests.ConnectionError:
                if process.poll() is not None or time.monotonic() > deadline:
                    pytest.fail("local_api.py ไม่ยอมเปิด")
                time.sleep(0.3)
        yield url
    finally:
        process.terminate()
        process.wait(timeout=10)


def sign_in(base_url: str, email: str, password: str = PASSWORD) -> dict[str, str]:
    response = requests.post(
        f"{base_url}/_dev/sign-in", json={"email": email, "password": password}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['accessToken']}"}


def test_public_routes(base_url):
    assert requests.get(f"{base_url}/health").json() == {"status": "ok"}
    events = requests.get(f"{base_url}/events").json()["items"]
    assert [event["eventId"] for event in events] == ["demo-event"]
    lots = requests.get(f"{base_url}/events/demo-event/lots").json()["items"]
    assert len(lots) == 12


def test_like_api_gateway(base_url):
    no_token = requests.get(f"{base_url}/me")
    assert (no_token.status_code, no_token.json()) == (401, {"message": "Unauthorized"})
    bad_token = requests.get(f"{base_url}/me", headers={"Authorization": "Bearer xyz"})
    assert bad_token.status_code == 401
    assert requests.get(f"{base_url}/nope").status_code == 404

    preflight = requests.options(f"{base_url}/me", headers={"Origin": ORIGIN})
    assert preflight.status_code == 204
    assert preflight.headers["Access-Control-Allow-Origin"] == ORIGIN
    assert "authorization" in preflight.headers["Access-Control-Allow-Headers"]
    other = requests.get(f"{base_url}/health", headers={"Origin": "http://evil.test"})
    assert "Access-Control-Allow-Origin" not in other.headers


def test_demo_accounts_sign_in_with_groups(base_url):
    accounts = requests.get(f"{base_url}/_dev/accounts").json()["items"]
    assert {account["role"] for account in accounts} == {"ADMIN", "ORGANIZER", "SELLER"}

    admin = sign_in(base_url, "admin@bookmybooth.test")
    assert requests.get(f"{base_url}/me", headers=admin).json()["role"] == "ADMIN"
    sellers = requests.get(f"{base_url}/admin/users", headers=admin, params={"role": "SELLER"})
    assert sellers.status_code == 200
    assert "seller@bookmybooth.test" in {user["email"] for user in sellers.json()["items"]}

    wrong = requests.post(
        f"{base_url}/_dev/sign-in",
        json={"email": "admin@bookmybooth.test", "password": "wrong-pass1"},
    )
    assert (wrong.status_code, wrong.json()["error"]["code"]) == (400, "NotAuthorizedException")


def test_sign_up_confirm_runs_post_confirmation(base_url):
    email = "new-seller@example.com"
    body = {"email": email, "password": "abcd1234", "role": "seller"}
    assert requests.post(f"{base_url}/_dev/sign-up", json=body).status_code == 200

    unconfirmed = requests.post(f"{base_url}/_dev/sign-in", json=body)
    assert unconfirmed.json()["error"]["code"] == "UserNotConfirmedException"

    profile = {"name": "นิว", "phone": "0811111111", "orgName": "ร้านนิว", "category": "อาหาร"}
    confirm = {"email": email, "code": "000000", "profile": profile}
    assert requests.post(f"{base_url}/_dev/confirm", json=confirm).status_code == 200

    me = requests.get(f"{base_url}/me", headers=sign_in(base_url, email, "abcd1234")).json()
    assert (me["role"], me["status"], me["shopName"]) == ("SELLER", "ACTIVE", "ร้านนิว")

    again = requests.post(f"{base_url}/_dev/sign-up", json=body)
    assert again.json()["error"]["code"] == "UsernameExistsException"


def test_booking_and_slip_upload_to_moto(base_url):
    seller = sign_in(base_url, "seller@bookmybooth.test")
    created = requests.post(
        f"{base_url}/bookings",
        headers=seller,
        json={"eventId": "demo-event", "lotIds": ["A01", "A02"], "shopName": "ขนมบ้านสวน"},
    )
    assert created.status_code == 201, created.text
    booking_id = created.json()["bookings"][0]["bookingId"]

    upload = requests.post(
        f"{base_url}/bookings/{booking_id}/slip-url",
        headers=seller,
        json={"contentType": "image/png"},
    ).json()
    # เบราว์เซอร์อัปโหลดตรงไปที่ moto ด้วย FormData แบบเดียวกับ S3 จริง
    sent = requests.post(
        upload["url"], data=upload["fields"], files={"file": ("slip.png", b"png", "image/png")}
    )
    assert sent.status_code in (200, 204), sent.text

    attached = requests.post(
        f"{base_url}/bookings/{booking_id}/slip", headers=seller, json={"key": upload["key"]}
    )
    assert attached.status_code == 200, attached.text
    assert {b["status"] for b in attached.json()["bookings"]} == {"PENDING_REVIEW"}

    admin = sign_in(base_url, "admin@bookmybooth.test")
    [event] = requests.get(f"{base_url}/admin/events", headers=admin).json()["items"]
    assert (event["bookingCount"], event["revenue"]) == (2, 0)


def test_reset_password_and_suspended_sign_in(base_url):
    email = "reset-me@example.com"
    requests.post(f"{base_url}/_dev/sign-up", json={"email": email, "password": "old12345"})
    requests.post(f"{base_url}/_dev/confirm", json={"email": email, "code": "1", "profile": {}})

    reset = {"email": email, "code": "000000", "newPassword": "new12345"}
    assert requests.post(f"{base_url}/_dev/reset-password", json=reset).status_code == 200
    headers = sign_in(base_url, email, "new12345")
    unknown = {**reset, "email": "nobody@example.com"}
    assert requests.post(f"{base_url}/_dev/reset-password", json=unknown).status_code == 200

    user_id = requests.get(f"{base_url}/me", headers=headers).json()["userId"]
    admin = sign_in(base_url, "admin@bookmybooth.test")
    suspend = requests.post(
        f"{base_url}/admin/users/{user_id}/suspend", headers=admin, json={"reason": "ทดสอบ"}
    )
    assert suspend.status_code == 200
    blocked = requests.post(
        f"{base_url}/_dev/sign-in", json={"email": email, "password": "new12345"}
    )
    assert blocked.json()["error"] == {
        "code": "NotAuthorizedException",
        "message": "User is disabled.",
    }
    assert requests.get(f"{base_url}/me", headers=headers).json()["error"]["code"] == (
        "ACCOUNT_SUSPENDED"
    )


def test_dev_expire_runs_sweep(base_url):
    response = requests.post(f"{base_url}/_dev/expire")
    assert response.status_code == 200
    assert response.json() == {"expired": []}
