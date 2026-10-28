"""ยิง POST /bookings จองล็อกเดียวกันพร้อมกัน ตรวจว่าสำเร็จแค่ 1 (PLAN ข้อ 10.2)

ใช้กับ API จริงบน AWS (หรือ API จำลองในเครื่อง) ต้องมี access token ของผู้ขาย:
- AWS: ล็อกอินเป็นผู้ขายในหน้าเว็บ → DevTools → Application → Local Storage →
  ค่าของ key ที่ลงท้ายด้วย `.accessToken` (CognitoIdentityServiceProvider....)
- API จำลอง: `dev.<userId>` จาก GET /_dev/accounts

ส่ง --token ซ้ำได้หลายตัว (เช่นผู้ขาย 5 คน) ถ้าส่งตัวเดียวจะใช้ token เดิมทุก request
ล็อกต้องว่างก่อนรัน และผู้ขายยังไม่เต็มโควตาของงาน (ไม่งั้นได้ 409 QUOTA_EXCEEDED ทุก request)
ยิงไม่เกิน 5 request เพื่อไม่ให้เกิน limit 10 concurrent ของ Learner Lab

    python scripts/race_test.py --api-url https://xxx.execute-api.us-east-1.amazonaws.com \\
        --event-id demo-event --lot-id A03 --token <accessToken>

ผ่าน = 201 × 1 และ 409 × ที่เหลือ (exit code 0) · ไม่ผ่าน exit code 1
หลังทดสอบ ให้ผู้ขายที่จองได้กดยกเลิกในหน้าการจองของฉัน เพื่อคืนล็อก
"""

import argparse
import sys
import threading
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

import requests

MAX_REQUESTS = 5


def book(api_url: str, token: str, event_id: str, lot_id: str, start: threading.Barrier):
    start.wait()  # ปล่อยทุก thread พร้อมกัน
    response = requests.post(
        f"{api_url}/bookings",
        json={"eventId": event_id, "lotIds": [lot_id], "shopName": "race test"},
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    try:
        body = response.json()
    except ValueError:
        body = response.text
    return response.status_code, body


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")  # console ของ Windows ไม่ใช่ UTF-8
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--api-url", required=True, help="Invoke URL ไม่มี / ท้าย")
    parser.add_argument("--event-id", required=True)
    parser.add_argument("--lot-id", required=True)
    parser.add_argument("--token", action="append", required=True, help="access token ของผู้ขาย")
    parser.add_argument("--requests", type=int, default=MAX_REQUESTS)
    args = parser.parse_args()

    count = min(args.requests, MAX_REQUESTS)
    tokens = [args.token[i % len(args.token)] for i in range(count)]
    api_url = args.api_url.rstrip("/")
    start = threading.Barrier(count)

    with ThreadPoolExecutor(max_workers=count) as pool:
        futures = [
            pool.submit(book, api_url, token, args.event_id, args.lot_id, start) for token in tokens
        ]
        results = [future.result() for future in futures]

    for index, (status, body) in enumerate(results, 1):
        code = body.get("error", {}).get("code") if isinstance(body, dict) else ""
        print(f"request {index}: {status} {code or ''}".rstrip())

    statuses = Counter(status for status, _ in results)
    print(f"สรุป: {dict(statuses)}")
    passed = statuses[201] == 1 and statuses[409] == count - 1
    print("ผ่าน ✔ จองได้คนเดียว" if passed else "ไม่ผ่าน ✘ ต้องได้ 201 × 1 และ 409 ที่เหลือ")
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
