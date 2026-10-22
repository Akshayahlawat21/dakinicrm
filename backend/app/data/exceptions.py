class DataLayerError(Exception):
    """Base exception for all Data Layer operations."""
    def __init__(self, message: str, details: dict = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class RecordNotFoundError(DataLayerError):
    """Raised when a requested database record is not found or inaccessible."""
    def __init__(self, entity_name: str, record_id: str):
        super().__init__(f"{entity_name} with ID '{record_id}' was not found")
        self.entity_name = entity_name
        self.record_id = record_id


class UniqueViolationError(DataLayerError):
    """Raised on unique constraint or duplicate record collisions."""
    def __init__(self, message: str, field: str = None, details: dict = None):
        super().__init__(message, details)
        self.field = field


class ForeignKeyViolationError(DataLayerError):
    """Raised when foreign key relationship is invalid or crosses tenants."""
    def __init__(self, message: str, details: dict = None):
        super().__init__(message, details)


class TenantIsolationViolationError(DataLayerError):
    """Raised when a query attempts to access or link records belonging to another tenant."""
    def __init__(self, message: str = "Cross-tenant record access is strictly forbidden"):
        super().__init__(message)


class ConcurrentModificationError(DataLayerError):
    """Raised when optimistic concurrency checks fail."""
    def __init__(self, message: str = "Record has been modified by another concurrent transaction"):
        super().__init__(message)


class DatabaseConnectionError(DataLayerError):
    """Raised when database connection fails or pool is exhausted."""
    def __init__(self, message: str = "Could not connect to database"):
        super().__init__(message)
