import uuid
from dataclasses import dataclass
from typing import Optional


KNOWN_UUID_ALIASES = {
    "tenant_enterprise_01": uuid.UUID("b4b76cde-a5e0-5ffb-9670-2df601cd5eef"),
    "dakini-enterprise": uuid.UUID("b4b76cde-a5e0-5ffb-9670-2df601cd5eef"),
    "default": uuid.UUID("b4b76cde-a5e0-5ffb-9670-2df601cd5eef"),
    "usr_elena": uuid.UUID("e7e81b6a-d30e-5270-87f1-260879092306"),
    "usr_elena.rostova": uuid.UUID("e7e81b6a-d30e-5270-87f1-260879092306"),
    "elena.rostova@dakini.ai": uuid.UUID("e7e81b6a-d30e-5270-87f1-260879092306"),
    "usr_marcus": uuid.UUID("33333333-3333-3333-3333-333333330002"),
    "usr_marcus.vance": uuid.UUID("33333333-3333-3333-3333-333333330002"),
    "marcus.vance@dakini.ai": uuid.UUID("33333333-3333-3333-3333-333333330002"),
    "usr_dev": uuid.UUID("33333333-3333-3333-3333-333333330003"),
    "usr_dev.singhania": uuid.UUID("33333333-3333-3333-3333-333333330003"),
    "dev.singhania@dakini.ai": uuid.UUID("33333333-3333-3333-3333-333333330003"),
    "usr_asha": uuid.UUID("33333333-3333-3333-3333-333333330004"),
    "usr_asha.nair": uuid.UUID("33333333-3333-3333-3333-333333330004"),
    "asha.nair@dakini.ai": uuid.UUID("33333333-3333-3333-3333-333333330004"),
}

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
        s_val = str(self.user_id).strip()
        if s_val in KNOWN_UUID_ALIASES:
            return KNOWN_UUID_ALIASES[s_val]
        try:
            return uuid.UUID(s_val)
        except ValueError:
            return uuid.uuid5(uuid.NAMESPACE_DNS, s_val)

    @property
    def tenant_uuid(self) -> uuid.UUID:
        s_val = str(self.tenant_id).strip()
        if s_val in KNOWN_UUID_ALIASES:
            return KNOWN_UUID_ALIASES[s_val]
        try:
            return uuid.UUID(s_val)
        except ValueError:
            return uuid.uuid5(uuid.NAMESPACE_DNS, s_val)
