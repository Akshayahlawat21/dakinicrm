import uuid
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.application.context import RequestContext
from backend.app.application.exceptions import BadRequestError, NotFoundError, ForbiddenError, ConflictError
from backend.app.data.models.contact import Contact
from backend.app.data.models.account import Account
from backend.app.data.repositories.contact_repository import ContactRepository
from backend.app.data.repositories.base import phones_match
from backend.app.data.repositories.account_repository import AccountRepository
from backend.app.data.repositories.team_repository import TeamRepository
from backend.app.data.repositories.user_repository import UserRepository
from backend.app.data.repositories.audit_repository import AuditLogRepository
from backend.app.data.exceptions import RecordNotFoundError
from backend.app.application.permissions import PermissionService


class ContactService:
    """Service for customer contacts with relationship-based access scoping."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.contact_repo = ContactRepository(session)
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

    async def _get_authorized_account_ids_for_caller(self, ctx: RequestContext) -> Optional[List[uuid.UUID]]:
        if ctx.is_owner:
            return None
        user_ids = await self._get_authorized_users_for_caller(ctx)
        return await self.account_repo.get_authorized_account_ids_for_users(ctx.tenant_id, user_ids)

    def _get_unauthorized_opp_contact_ids(self, ctx: RequestContext, user_ids: List[uuid.UUID]):
        from backend.app.data.models.deal import Opportunity
        from sqlalchemy import select
        unauthorized_opp_contacts_stmt = (
            select(Opportunity.contact_id)
            .where(
                Opportunity.organization_id == ctx.tenant_uuid,
                Opportunity.contact_id.is_not(None),
                ~Opportunity.owner_id.in_(user_ids),
            )
        )
        authorized_opp_contacts_stmt = (
            select(Opportunity.contact_id)
            .where(
                Opportunity.organization_id == ctx.tenant_uuid,
                Opportunity.contact_id.is_not(None),
                Opportunity.owner_id.in_(user_ids),
            )
        )
        diff = unauthorized_opp_contacts_stmt.except_(authorized_opp_contacts_stmt)
        return select(diff.subquery())

    async def get_contact(self, ctx: RequestContext, contact_id: str | uuid.UUID) -> Contact:
        try:
            contact = await self.contact_repo.get_by_id_scoped(contact_id, ctx.tenant_id)
            if ctx.is_owner:
                return contact

            authorized_account_ids = await self._get_authorized_account_ids_for_caller(ctx)
            if authorized_account_ids is not None and contact.account_id not in authorized_account_ids:
                raise ForbiddenError("You are not authorized to access this contact")

            user_ids = await self._get_authorized_users_for_caller(ctx)
            exclude_subq = self._get_unauthorized_opp_contact_ids(ctx, user_ids)
            from sqlalchemy import select
            check_ex = await self.session.execute(select(Contact.id).where(Contact.id == contact.id, Contact.id.in_(exclude_subq)))
            if check_ex.scalar_one_or_none():
                raise ForbiddenError("You are not authorized to access this contact")

            return contact
        except RecordNotFoundError:
            raise NotFoundError(f"Contact '{contact_id}' was not found in this organization")

    async def list_contacts(
        self,
        ctx: RequestContext,
        skip: int = 0,
        limit: int = 50,
        account_id: Optional[str | uuid.UUID] = None,
    ) -> tuple[List[Contact], int]:
        filters = {}
        if account_id:
            filters["account_id"] = uuid.UUID(str(account_id))

        if ctx.is_owner:
            return await self.contact_repo.list_scoped(
                tenant_id=ctx.tenant_id, skip=skip, limit=limit, filters=filters
            )

        authorized_account_ids = await self._get_authorized_account_ids_for_caller(ctx)
        if authorized_account_ids is None:
            return await self.contact_repo.list_scoped(
                tenant_id=ctx.tenant_id, skip=skip, limit=limit, filters=filters
            )

        user_ids = await self._get_authorized_users_for_caller(ctx)
        exclude_subq = self._get_unauthorized_opp_contact_ids(ctx, user_ids)

        if account_id:
            req_acc_id = uuid.UUID(str(account_id))
            if req_acc_id not in authorized_account_ids:
                return [], 0
            return await self.contact_repo.list_scoped_by_accounts(
                tenant_id=ctx.tenant_id,
                account_ids=[req_acc_id],
                skip=skip,
                limit=limit,
                filters=filters,
                exclude_contact_ids=exclude_subq,
            )

        return await self.contact_repo.list_scoped_by_accounts(
            tenant_id=ctx.tenant_id,
            account_ids=authorized_account_ids,
            skip=skip,
            limit=limit,
            filters=filters,
            exclude_contact_ids=exclude_subq,
        )

    async def check_duplicate_contact(
        self,
        ctx: RequestContext,
        name: Optional[str] = None,
        company: Optional[str] = None,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        title: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Check for duplicate contact in the organization.
        Warns if name + company name + (email OR phone) (+ optional job title) match.
        """
        clean_name = name.strip() if name and name.strip() else None
        clean_company = company.strip() if company and company.strip() else None
        clean_email = email.lower().strip() if email and email.strip() else None
        clean_phone = phone.strip() if phone and phone.strip() else None
        clean_title = title.strip() if title and title.strip() else None

        # Give the warning ONLY if name + company + (email OR phone) match
        if not clean_name or not clean_company or (not clean_email and not clean_phone):
            return None

        from sqlalchemy import select, func
        from backend.app.data.models.account import Account

        stmt = (
            select(Contact, Account.name)
            .join(Account, Account.id == Contact.account_id)
            .where(
                Account.organization_id == ctx.tenant_uuid,
                Contact.deleted_at.is_(None),
                Account.deleted_at.is_(None),
                func.lower(func.trim(Account.name)) == clean_company.lower(),
            )
        )
        res = await self.session.execute(stmt)
        rows = res.all()

        for contact_entity, acc_name in rows:
            # 1. Match email or phone
            email_match = bool(clean_email and contact_entity.email and contact_entity.email.lower().strip() == clean_email)
            phone_match = bool(clean_phone and phones_match(clean_phone, contact_entity.phone))

            if not email_match and not phone_match:
                continue

            c_first = (contact_entity.first_name or "").strip().lower()
            c_last = (contact_entity.last_name or "").strip().lower()
            c_full = f"{c_first} {c_last}".strip()
            norm_input_name = clean_name.lower().strip()

            name_matches = (
                c_full == norm_input_name
                or (c_first and c_first == norm_input_name)
                or (c_full and (c_full in norm_input_name or norm_input_name in c_full))
                or (c_first and (c_first in norm_input_name or norm_input_name in c_first))
            )
            if not name_matches:
                continue

            # Optional job title match: if caller provided title and existing contact has title,
            # verify title matches too
            if clean_title and contact_entity.title:
                if clean_title.lower() != contact_entity.title.strip().lower():
                    continue

            channel_info = contact_entity.email or contact_entity.phone or ""
            return {
                "is_duplicate_warning": True,
                "existing_contact_id": str(contact_entity.id),
                "existing_contact_name": f"{contact_entity.first_name} {contact_entity.last_name}".strip(),
                "existing_company": acc_name,
                "existing_email": contact_entity.email,
                "existing_phone": contact_entity.phone,
                "existing_title": contact_entity.title,
                "warning_message": (
                    f"A contact matching '{contact_entity.first_name} {contact_entity.last_name}' at '{acc_name}' "
                    f"({channel_info}{f' - {contact_entity.title}' if contact_entity.title else ''}) already exists in {'your organization' if ctx.is_owner else 'your contacts'}."
                ),
            }
        return None

    async def create_contact(
        self,
        ctx: RequestContext,
        account_id: str | uuid.UUID,
        first_name: str,
        last_name: str,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        title: Optional[str] = None,
        department: Optional[str] = None,
        allow_separate_contact: bool = False,
    ) -> Contact:
        if not first_name or not first_name.strip():
            raise BadRequestError("First name is required")

        # Verify parent account belongs to caller's tenant
        try:
            account = await self.account_repo.get_by_id_scoped(account_id, ctx.tenant_id)
        except RecordNotFoundError:
            raise NotFoundError(f"Account '{account_id}' does not exist in this organization")

        # Validate access to parent account
        if not ctx.is_owner:
            authorized_account_ids = await self._get_authorized_account_ids_for_caller(ctx)
            if authorized_account_ids is not None and account.id not in authorized_account_ids:
                raise ForbiddenError("You are not authorized to create contacts for this account")

        clean_email = email.lower().strip() if email else None
        clean_phone = phone.strip() if phone else None
        clean_first = first_name.strip()
        clean_last = last_name.strip() if last_name else ""
        clean_full_name = f"{clean_first} {clean_last}".strip()

        if not allow_separate_contact and (clean_email or clean_phone):
            dup = await self.check_duplicate_contact(
                ctx=ctx,
                name=clean_full_name,
                company=account.name,
                email=clean_email,
                phone=clean_phone,
                title=title,
            )
            if dup and dup.get("is_duplicate_warning"):
                raise ConflictError(
                    message=dup["warning_message"],
                    details=dup,
                )

        # Contact Deduplication: prevent duplicate contacts using normalized email
        if clean_email and not allow_separate_contact:
            existing_contact = await self.contact_repo.get_by_normalized_email(
                tenant_id=ctx.tenant_id,
                email=clean_email,
                account_id=account.id,
            )
            if not existing_contact:
                from sqlalchemy import select, func
                stmt_any = (
                    select(Contact)
                    .join(Account, Account.id == Contact.account_id)
                    .where(
                        Account.organization_id == ctx.tenant_uuid,
                        Contact.deleted_at.is_(None),
                        Account.deleted_at.is_(None),
                        func.lower(func.trim(Contact.email)) == clean_email,
                        func.lower(func.trim(Account.name)) == account.name.lower().strip(),
                    )
                )
                existing_contact = (await self.session.execute(stmt_any)).scalars().first()

            if existing_contact:
                # Reuse existing contact and augment missing details
                if phone and not existing_contact.phone:
                    existing_contact.phone = phone
                if title and not existing_contact.title:
                    existing_contact.title = title
                if department and not existing_contact.department:
                    existing_contact.department = department
                await self.audit_repo.record_event(
                    tenant_id=ctx.tenant_id,
                    user_id=ctx.user_id,
                    action="CREATE",
                    resource_type="contact",
                    resource_id=existing_contact.id,
                    new_values={"name": f"{existing_contact.first_name} {existing_contact.last_name}", "linked_user": str(ctx.user_id)},
                )
                await self.session.flush()
                return existing_contact

        contact = Contact(
            account_id=account.id,
            first_name=clean_first,
            last_name=clean_last,
            email=clean_email,
            phone=phone,
            title=title,
            department=department,
        )
        self.session.add(contact)
        await self.session.flush()

        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="CREATE",
            resource_type="contact",
            resource_id=contact.id,
            new_values={"name": f"{clean_first} {clean_last}", "account_id": str(account.id)},
        )
        return contact

    async def delete_contact(self, ctx: RequestContext, contact_id: str | uuid.UUID) -> bool:
        contact = await self.get_contact(ctx, contact_id)
        is_team_contact = False
        if ctx.is_manager:
            authorized_ids = await self._get_authorized_account_ids_for_caller(ctx)
            if authorized_ids is None or contact.account_id in authorized_ids:
                is_team_contact = True

        PermissionService.check_can_delete_contact(
            ctx=ctx,
            contact_tenant_id=str(ctx.tenant_id),
            is_team_contact=is_team_contact,
        )

        from datetime import datetime, timezone
        contact.deleted_at = datetime.now(timezone.utc)
        await self.session.flush()
        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="DELETE",
            resource_type="contact",
            resource_id=contact.id,
            old_values={"first_name": contact.first_name, "last_name": contact.last_name},
        )
        return True

