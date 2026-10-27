class AppError(Exception):
    """ข้อผิดพลาดที่ตั้งใจคืนให้ผู้ใช้ แปลงเป็น {"error": {code, message}} ใน shared/http.py"""

    def __init__(self, code: str, message: str, status: int = 400, details: object = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.details = details


def bad_request(message: str, code: str = "BAD_REQUEST") -> AppError:
    return AppError(code, message, 400)


def forbidden(message: str = "ไม่มีสิทธิ์ทำรายการนี้", code: str = "FORBIDDEN") -> AppError:
    return AppError(code, message, 403)


def not_found(message: str = "ไม่พบข้อมูล", code: str = "NOT_FOUND") -> AppError:
    return AppError(code, message, 404)


def conflict(message: str, code: str = "CONFLICT", details: object = None) -> AppError:
    return AppError(code, message, 409, details)
