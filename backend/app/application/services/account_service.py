import uuid
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.application.context import RequestContext
from backend.app.application.permissions import PermissionService
from backend.app.application.exceptions import BadRequestError, NotFoundError, ForbiddenError, ConflictError
from backend.app.data.models.account import Account
from backend.app.data.repositories.account_repository import AccountRepository
from backend.app.data.repositories.base import phones_match
from backend.app.data.repositories.team_repository import TeamRepository
from backend.app.data.repositories.user_repository import UserRepository
from backend.app.data.repositories.audit_repository import AuditLogRepository
from backend.app.data.exceptions import RecordNotFoundError


class AccountService:
    """Service for managing enterprise client accounts with relationship-based access scoping."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.account_repo = AccountRepository(session)
        self.team_repo = TeamRepository(session)
        self.user_repo = UserRepository(session)
        self.audit_repo = AuditLogRepository(session)

    async def _get_authorized_users_for_caller(self, ctx: RequestContext) -> List[uuid.UUID]:
        if ctx.is_salesperson:
            return [ctx.user_uuid]
        if ctx.is_manager:
            mgr_team = await self.team_repo.get_active_manager_team(ctx.user_id, ctx.tenant_id)
            if not mgr_team:
                return [ctx.user_uuid]
            team_users = await self.user_repo.list_by_team(mgr_team.id, ctx.tenant_id)
            return [u.id for u in team_users] + [ctx.user_uuid]
        return []

    async def get_account(self, ctx: RequestContext, account_id: str | uuid.UUID) -> Account:
        try:
            account = await self.account_repo.get_by_id_scoped(account_id, ctx.tenant_id)
            if ctx.is_owner:
                return account

            user_ids = await self._get_authorized_users_for_caller(ctx)
            accessible_ids = await self.account_repo.get_authorized_account_ids_for_users(
                ctx.tenant_id, user_ids
            )
            if account.id not in accessible_ids:
                raise ForbiddenError("You are not authorized to access this account")
            return account
        except RecordNotFoundError:
            raise NotFoundError(f"Account '{account_id}' was not found in this organization")

    async def list_accounts(
        self, ctx: RequestContext, skip: int = 0, limit: int = 50
    ) -> tuple[List[Account], int]:
        if ctx.is_owner:
            return await self.account_repo.list_scoped(
                tenant_id=ctx.tenant_id, skip=skip, limit=limit
            )

        user_ids = await self._get_authorized_users_for_caller(ctx)
        accessible_ids = await self.account_repo.get_authorized_account_ids_for_users(
            ctx.tenant_id, user_ids
        )
        return await self.account_repo.list_scoped_by_ids(
            tenant_id=ctx.tenant_id, account_ids=accessible_ids, skip=skip, limit=limit
        )

    async def get_account_by_name(self, ctx: RequestContext, name: str) -> Optional[Account]:
        if not name or not name.strip():
            return None
        from sqlalchemy import select, func
        clean_name = name.strip()
        stmt = (
            select(Account)
            .where(
                Account.organization_id == ctx.tenant_uuid,
                Account.deleted_at.is_(None),
                func.lower(func.trim(Account.name)) == clean_name.lower(),
            )
            .limit(1)
        )
        res = await self.session.execute(stmt)
        return res.scalar_one_or_none()

    async def check_duplicate_account(
        self,
        ctx: RequestContext,
        name: Optional[str] = None,
        phone: Optional[str] = None,
        industry: Optional[str] = None,
        location: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Context-Scoped Account Duplicate Check:
        - Warns if phone number matches an existing account in caller's context.
        - Warns if (company name + industry + location) match in caller's context.
        - For Owners, all accounts across the organization are checked.
        - For non-owners, scoped to authorized accounts.
        """
        clean_name = name.strip() if name and name.strip() else None
        clean_phone = phone.strip() if phone and phone.strip() else None
        clean_industry = industry.strip() if industry and industry.strip() else None
        clean_location = location.strip() if location and location.strip() else None

        # Give warning if phone matches, OR if all 3 match: company name + industry + location
        if not clean_phone and (not clean_name or not clean_industry or not clean_location):
            return None

        from sqlalchemy import select, func
        candidates_by_id = {}

        if clean_phone:
            phone_matches = await self.account_repo.list_by_phone(clean_phone, ctx.tenant_id)
            for acc in phone_matches:
                candidates_by_id[acc.id] = acc

        if clean_name and clean_industry and clean_location:
            stmt = (
                select(Account)
                .where(
                    Account.organization_id == ctx.tenant_uuid,
                    Account.deleted_at.is_(None),
                    func.lower(func.trim(Account.name)) == clean_name.lower(),
                )
            )
            res = await self.session.execute(stmt)
            for acc in res.scalars().all():
                candidates_by_id[acc.id] = acc

        candidates = list(candidates_by_id.values())

        # Context scoping: For non-owners (Salesperson / Manager), only accounts ALREADY
        # in their authorized context are considered duplicates.
        if not ctx.is_owner:
            user_ids = await self._get_authorized_users_for_caller(ctx)
            accessible_ids = await self.account_repo.get_authorized_account_ids_for_users(
                ctx.tenant_id, user_ids
            )
            candidates = [acc for acc in candidates if acc.id in accessible_ids]

        if not candidates:
            return None

        scope_name = "your organization" if ctx.is_owner else "your accounts"

        for acc in candidates:
            # 1. Phone match check
            if clean_phone and phones_match(clean_phone, acc.phone):
                return {
                    "is_duplicate_warning": True,
                    "existing_account_id": str(acc.id),
                    "existing_account_name": acc.name,
                    "existing_phone": acc.phone,
                    "existing_industry": acc.industry,
                    "existing_location": acc.address or clean_location,
                    "warning_message": (
                        f"An active account with phone '{acc.phone}' ('{acc.name}') already exists in {scope_name}."
                    ),
                }

            # 2. Company name + industry + location check
            if clean_name and clean_industry and clean_location:
                # Match industry
                acc_ind = (acc.industry or "").strip().lower()
                req_ind = clean_industry.lower()
                if not (req_ind == acc_ind or req_ind in acc_ind or acc_ind in req_ind):
                    continue

                # Match location
                acc_address = (acc.address or "").strip()
                norm_loc = clean_location.lower()
                norm_addr = acc_address.lower() if acc_address else ""

                is_loc_match = False
                if not norm_addr:
                    is_loc_match = True
                elif norm_loc == norm_addr or norm_loc in norm_addr or norm_addr in norm_loc:
                    is_loc_match = True
                elif norm_loc in ["india", "in"] and norm_addr in ["india", "in"]:
                    is_loc_match = True

                if not is_loc_match:
                    continue

                return {
                    "is_duplicate_warning": True,
                    "existing_account_id": str(acc.id),
                    "existing_account_name": acc.name,
                    "existing_phone": acc.phone,
                    "existing_industry": acc.industry,
                    "existing_location": acc.address or clean_location,
                    "warning_message": (
                        f"An active account matching '{acc.name}' in '{acc.industry}' at '{acc.address or clean_location}' already exists in {scope_name}."
                    ),
                }
        return None

    async def create_account(
        self,
        ctx: RequestContext,
        name: str,
        industry: Optional[str] = None,
        website: Optional[str] = None,
        phone: Optional[str] = None,
        address: Optional[str] = None,
        allow_separate_account: bool = False,
    ) -> Account:
        if not name or not name.strip():
            raise BadRequestError("Account name is required")

        clean_name = name.strip()

        # 1. Check duplicate in caller's context:
        if not allow_separate_account:
            dup = await self.check_duplicate_account(
                ctx=ctx,
                name=clean_name,
                phone=phone,
                industry=industry,
                location=address,
            )
            if dup and dup.get("is_duplicate_warning"):
                raise ConflictError(
                    message=dup["warning_message"],
                    details=dup,
                )

        clean_addr = address.strip() if address and address.strip() else None
        if clean_addr and clean_addr.lower() == "india":
            clean_addr = "India"

        # 2. Check if this company already exists in the organization (e.g. in Owner's records):
        # If it exists in Owner records but not in the salesperson's context, linking it to the salesperson
        # adds it to their context without creating duplicate company records in the database.
        if not allow_separate_account:
            existing_org_acc = await self.account_repo.get_by_name(clean_name, ctx.tenant_id)
            if existing_org_acc:
                # Add this account to the salesperson's context via audit log
                await self.audit_repo.record_event(
                    tenant_id=ctx.tenant_id,
                    user_id=ctx.user_id,
                    action="CREATE",
                    resource_type="account",
                    resource_id=existing_org_acc.id,
                    new_values={
                        "name": existing_org_acc.name,
                        "industry": existing_org_acc.industry,
                        "linked_user": str(ctx.user_id),
                    },
                )
                if website and not existing_org_acc.website:
                    existing_org_acc.website = website
                if phone and not existing_org_acc.phone:
                    existing_org_acc.phone = phone
                await self.session.flush()
                return existing_org_acc

        # 3. First time creation across the whole organization:
        account = Account(
            organization_id=ctx.tenant_uuid,
            name=clean_name,
            industry=industry,
            website=website,
            phone=phone,
            address=clean_addr,
            status="active",
        )
        created = await self.account_repo.create(account, ctx.tenant_id)
        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="CREATE",
            resource_type="account",
            resource_id=created.id,
            new_values={"name": clean_name, "industry": industry},
        )
        return created

    async def delete_account(self, ctx: RequestContext, account_id: str | uuid.UUID) -> bool:
        # Strictly restrict account deletion to organization Owners
        PermissionService.check_can_delete_account(ctx, str(ctx.tenant_id))

        try:
            account = await self.get_account(ctx, account_id)
        except NotFoundError:
            account = await self.account_repo.get_by_name(str(account_id), ctx.tenant_id)
            if not account:
                raise NotFoundError(f"Account '{account_id}' was not found in this organization")

        from datetime import datetime, timezone
        account.deleted_at = datetime.now(timezone.utc)
        await self.session.flush()
        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="DELETE",
            resource_type="account",
            resource_id=account.id,
            old_values={"name": account.name},
        )
        return True

