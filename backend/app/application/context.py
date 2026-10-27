import uuid
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class RequestContext:
    """
    Immutable request context carrying verified caller identity and tenant isolation boundaries.
    Constructed ONLY from verified Gateway headers or authenticated JWT tokens.
    Never constructed from request body or untrusted query parameters.
    """
    user_id: str
    tenant_id: str
    role: str  # 'owner', 'manager', 'salesperson'
    team_id: Optional[str] = None
    token_version: int = 1
    must_change_password: bool = False
    correlation_id: str = "req_internal"
    can_access_unassigned: bool = False

    def __post_init__(self):
        # Normalize role to lowercase
        object.__setattr__(self, "role", self.role.lower().strip() if self.role else "salesperson")

    @property
    def is_owner(self) -> bool:
        """Owner or system admin with full tenant-level permissions."""
        return self.role in ("owner", "admin", "system_admin", "director")

    @property
    def is_manager(self) -> bool:
        """Team manager with team-level oversight."""
        return self.role == "manager"

    @property
    def is_salesperson(self) -> bool:
        """Sales representative with personal/assigned record visibility."""
        return self.role in ("salesperson", "sales_rep", "sales_executive", "viewer")

    @property
    def user_uuid(self) -> uuid.UUID:
        try:
            return uuid.UUID(str(self.user_id))
        except ValueError:
            # Fallback namespace UUID if external id format like 'usr_elena'
            return uuid.uuid5(uuid.NAMESPACE_DNS, str(self.user_id))

    @property
    def tenant_uuid(self) -> uuid.UUID:
        try:
            return uuid.UUID(str(self.tenant_id))
        except ValueError:
            return uuid.uuid5(uuid.NAMESPACE_DNS, str(self.tenant_id))
