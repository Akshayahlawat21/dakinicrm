from typing import Optional, Dict, Any


class ApplicationError(Exception):
    """Base application layer domain exception."""
    def __init__(self, message: str, status_code: int = 400, code: str = "BAD_REQUEST", details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code
        self.details = details or {}


class BadRequestError(ApplicationError):
    def __init__(self, message: str, code: str = "BAD_REQUEST", details: Optional[Dict[str, Any]] = None):
        super().__init__(message=message, status_code=400, code=code, details=details)


class UnauthorizedError(ApplicationError):
    def __init__(self, message: str = "Authentication required", code: str = "UNAUTHORIZED"):
        super().__init__(message=message, status_code=401, code=code)


class ForbiddenError(ApplicationError):
    def __init__(self, message: str = "Permission denied", code: str = "FORBIDDEN", details: Optional[Dict[str, Any]] = None):
        super().__init__(message=message, status_code=403, code=code, details=details)


class NotFoundError(ApplicationError):
    def __init__(self, message: str = "Resource not found", code: str = "NOT_FOUND"):
        super().__init__(message=message, status_code=404, code=code)


class ConflictError(ApplicationError):
    def __init__(self, message: str, code: str = "CONFLICT", details: Optional[Dict[str, Any]] = None):
        super().__init__(message=message, status_code=409, code=code, details=details)


class InternalServerError(ApplicationError):
    def __init__(self, message: str = "Internal server error", code: str = "INTERNAL_SERVER_ERROR"):
        super().__init__(message=message, status_code=500, code=code)
