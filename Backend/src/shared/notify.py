from collections.abc import Iterable
from datetime import datetime, timedelta

from aws_lambda_powertools import Logger

from shared import clock, db
from shared.ids import new_id

logger = Logger()

TTL_DAYS = 90


def notify(
    user_ids: Iterable[str], type_: str, message: str, *, now: datetime, **refs: str | None
) -> None:
    """เขียนแจ้งเตือนหลัง transaction หลักสำเร็จแล้ว ถ้าเขียนไม่ได้แค่ log ไม่ทำให้คำขอล้ม

    refs: bookingId, eventId, link (ค่า None จะไม่ถูกเก็บ)
    """
    created_at = clock.iso(now)
    expires = int((now + timedelta(days=TTL_DAYS)).timestamp())
    extra = {key: value for key, value in refs.items() if value is not None}
    try:
        with db.table("notifications").batch_writer() as batch:
            for user_id in user_ids:
                notification_id = new_id()
                batch.put_item(
                    Item={
                        "userId": user_id,
                        "sk": f"{created_at}#{notification_id}",
                        "notificationId": notification_id,
                        "type": type_,
                        "message": message,
                        "read": False,
                        "createdAt": created_at,
                        "ttl": expires,
                        **extra,
                    }
                )
    except Exception:
        logger.exception("Failed to write notifications", extra={"type": type_})
