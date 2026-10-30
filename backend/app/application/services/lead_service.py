import uuid
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.application.context import RequestContext
from backend.app.application.permissions import PermissionService
from backend.app.application.exceptions import BadRequestError, ConflictError, NotFoundError, ForbiddenError
from backend.app.data.models.lead import Lead, LeadConversion
from backend.app.data.models.user import User
from backend.app.data.models.account import Account
from backend.app.data.models.contact import Contact
from backend.app.data.models.deal import Deal
from backend.app.data.repositories.lead_repository import LeadRepository
from backend.app.data.repositories.account_repository import AccountRepository
from backend.app.data.repositories.contact_repository import ContactRepository
from backend.app.data.repositories.deal_repository import DealRepository
from backend.app.data.repositories.team_repository import TeamRepository
from backend.app.data.repositories.user_repository import UserRepository
from backend.app.data.repositories.audit_repository import AuditLogRepository
from backend.app.data.exceptions import RecordNotFoundError


class LeadService:
    """
    Lead Management Service.
    Enforces duplicate checking, assignment validation, and atomic multi-entity
    lead conversion transactions.
    """

    def __init__(self, session: AsyncSession):
        self.session = session
        self.lead_repo = LeadRepository(session)
        self.account_repo = AccountRepository(session)
        self.contact_repo = ContactRepository(session)
        self.deal_repo = DealRepository(session)
        self.team_repo = TeamRepository(session)
        self.user_repo = UserRepository(session)
        self.audit_repo = AuditLogRepository(session)

    async def get_lead(self, ctx: RequestContext, lead_id: str | uuid.UUID) -> Lead:
        try:
            lead = await self.lead_repo.get_by_id_scoped(lead_id, ctx.tenant_id)

            # 1. Unassigned lead check
            if not lead.assigned_to:
                is_auth_mgr = getattr(ctx, "can_access_unassigned", False)
                PermissionService.check_can_access_unassigned_leads(ctx, is_authorized_manager=is_auth_mgr)
                return lead

            # 2. Team membership check for managers
            is_team_record = False
            if ctx.is_manager:
                mgr_team = await self.team_repo.get_active_manager_team(ctx.user_id, ctx.tenant_id)
                if mgr_team:
                    is_team_record = await self.team_repo.is_user_in_team(
                        lead.assigned_to, mgr_team.id, ctx.tenant_id
                    )

            PermissionService.check_record_access(
                ctx=ctx,
                record_tenant_id=str(lead.organization_id),
                assigned_to_id=str(lead.assigned_to),
                is_team_record=is_team_record,
            )
            return lead
        except RecordNotFoundError:
            raise NotFoundError(f"Lead '{lead_id}' was not found in this organization")

    async def list_leads(
        self,
        ctx: RequestContext,
        skip: int = 0,
        limit: int = 50,
        status: Optional[str] = None,
    ) -> tuple[List[Lead], int]:
        filters = {}
        if status and status.lower() != "all":
            filters["status"] = status

        if ctx.is_salesperson:
            # Salespersons strictly see only assigned leads
            filters["assigned_to"] = ctx.user_uuid
            return await self.lead_repo.list_scoped(
                tenant_id=ctx.tenant_id, skip=skip, limit=limit, filters=filters
            )

        if ctx.is_manager:
            # Managers strictly see leads assigned to members of their active team
            mgr_team = await self.team_repo.get_active_manager_team(ctx.user_id, ctx.tenant_id)
            if not mgr_team:
                return [], 0
            team_users = await self.user_repo.list_by_team(mgr_team.id, ctx.tenant_id)
            team_user_ids = [u.id for u in team_users] + [ctx.user_uuid]

            return await self.lead_repo.list_scoped_by_assignees(
                tenant_id=ctx.tenant_id,
                assignee_ids=team_user_ids,
                skip=skip,
                limit=limit,
                filters=filters,
            )

        # Owner: all organization leads
        return await self.lead_repo.list_scoped(
            tenant_id=ctx.tenant_id, skip=skip, limit=limit, filters=filters
        )

    async def check_duplicate_lead(
        self,
        ctx: RequestContext,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        company: Optional[str] = None,
        name: Optional[str] = None,
        title: Optional[str] = None,
        interested_product: Optional[str] = None,
        product_id: Optional[str | uuid.UUID] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Lead Duplicate Advisor (Warn, Don't Automatically Block).
        1. Checks for an active or converted Lead matching email OR (name + company) OR (name + product).
        2. Differentiates same-product duplicates vs distinct cross-sell inquiries.
        3. Job title differences alone DO NOT make an inquiry unique.
        4. If caller does not have permission to view the matched lead, redacts sensitive details.
        5. Identifies if the person is already an established Contact.
        """
        from datetime import datetime, timezone
        from sqlalchemy import select, func, or_
        now = datetime.now(timezone.utc)

        import re

        def norm_prod(p):
            return re.sub(r'[^a-z0-9]', '', (p or "").lower())

        clean_email = email.lower().strip() if email and email.strip() else None
        clean_phone = phone.strip() if phone and phone.strip() else None
        clean_name = name.strip() if name and name.strip() else None
        new_prod_norm = norm_prod(interested_product)

        # Requirement: Give the warning ONLY if all things match (name + contact info (email/phone) + interested_product)
        # because with the same name many people exist.
        if clean_name:
            if (not clean_email and not clean_phone) or not new_prod_norm:
                return None

        existing_leads_map = {}
        if clean_email:
            for l in await self.lead_repo.list_by_email(clean_email, ctx.tenant_id):
                existing_leads_map[l.id] = l
        if clean_phone:
            for l in await self.lead_repo.list_by_phone(clean_phone, ctx.tenant_id):
                existing_leads_map[l.id] = l

        existing_leads = list(existing_leads_map.values())

        # If name is provided, ensure existing lead matches the name too
        if clean_name and existing_leads:
            existing_leads = [
                l for l in existing_leads
                if l.name and l.name.strip().lower() == clean_name.lower()
            ]

        if not existing_leads:
            # Check contact table by email or phone
            contact = None
            if clean_email:
                contact = await self.contact_repo.get_by_normalized_email(ctx.tenant_id, clean_email)
            if not contact and clean_phone:
                contact = await self.contact_repo.get_by_normalized_phone(ctx.tenant_id, clean_phone)
            if contact:
                account_name = None
                if contact.account_id:
                    acc = await self.session.get(Account, contact.account_id)
                    if acc:
                        account_name = acc.name
                return {
                    "is_duplicate_warning": False,
                    "has_existing_contact": True,
                    "existing_contact_id": str(contact.id),
                    "existing_contact_name": contact.full_name,
                    "existing_company": account_name,
                    "notice_message": (
                        f"Note: '{contact.full_name}' is already an existing Contact at '{account_name or 'N/A'}'. "
                        f"Converting this inquiry will automatically link to the existing Contact without creating duplicates."
                    ),
                }
            return None

        # 1. Check for matching active (unconverted) lead
        active_leads = [
            l for l in existing_leads
            if l.status not in ("Converted", "Expired", "Lost", "Disqualified")
        ]

        if active_leads:
            import re
            active_lead = active_leads[0]
            created_at = active_lead.created_at
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            age_days = (now - created_at).total_seconds() / 86400.0

            # Product-aware duplicate check: name + email + interested product
            def norm_prod(p):
                return re.sub(r'[^a-z0-9]', '', (p or "").lower())

            new_norm = norm_prod(interested_product)
            existing_norm = norm_prod(active_lead.interested_product)

            if new_norm and existing_norm and new_norm != existing_norm:
                # Legitimate cross-sell opportunity for a different product!
                return {
                    "is_duplicate_warning": False,
                    "is_cross_sell": True,
                    "existing_lead_id": str(active_lead.id),
                    "existing_lead_name": active_lead.name,
                    "existing_product": active_lead.interested_product,
                    "new_product": interested_product.strip(),
                    "notice_message": (
                        f"Customer has an active lead for '{active_lead.interested_product}'. "
                        f"This new submission for '{interested_product.strip()}' is recognized as a valid cross-sell inquiry."
                    ),
                }

            # Check caller RBAC visibility
            is_authorized = False
            if ctx.is_owner:
                is_authorized = True
            elif ctx.is_manager:
                if not active_lead.assigned_to or active_lead.assigned_to == ctx.user_uuid:
                    is_authorized = True
                else:
                    mgr_team = await self.team_repo.get_active_manager_team(ctx.user_id, ctx.tenant_id)
                    if mgr_team:
                        is_authorized = await self.team_repo.is_user_in_team(
                            active_lead.assigned_to, mgr_team.id, ctx.tenant_id
                        )
            elif ctx.is_salesperson:
                is_authorized = (active_lead.assigned_to == ctx.user_uuid)

            if not is_authorized:
                return {
                    "is_duplicate_warning": True,
                    "is_restricted": True,
                    "warning_message": (
                        f"An active lead matching '{active_lead.name}' already exists in this organization "
                        f"assigned to another team member. A different job title or role alone does not make this inquiry unique. "
                        f"Please coordinate with your manager or confirm a separate inquiry."
                    ),
                }

            owner_name = "Unassigned"
            if active_lead.assigned_to:
                u = await self.session.get(User, active_lead.assigned_to)
                if u:
                    owner_name = u.name

            prod_snippet = f", Product: '{active_lead.interested_product}'" if active_lead.interested_product else ""
            status_desc = f"in '{active_lead.status}' status"
            return {
                "is_duplicate_warning": True,
                "is_restricted": False,
                "existing_lead_id": str(active_lead.id),
                "existing_lead_name": active_lead.name,
                "existing_company": active_lead.company,
                "existing_status": active_lead.status,
                "existing_owner": owner_name,
                "existing_product": active_lead.interested_product,
                "existing_created_at": active_lead.created_at.isoformat() if active_lead.created_at else None,
                "warning_message": (
                    f"A lead for '{active_lead.name}' {status_desc} "
                    f"(Company: {active_lead.company or 'N/A'}{prod_snippet}, Owner: {owner_name}). "
                    f"A different job title or role alone does not make this inquiry unique. "
                    f"Please confirm if this is a legitimate separate inquiry before proceeding."
                ),
            }

        # 2. Check if person is an existing Contact in contacts table OR has a Converted lead
        converted_leads = [l for l in existing_leads if l.status == "Converted"]
        if clean_email or clean_phone or converted_leads:
            contact = None
            if clean_email:
                contact = await self.contact_repo.get_by_normalized_email(ctx.tenant_id, clean_email)
            if not contact and clean_phone:
                contact = await self.contact_repo.get_by_normalized_phone(ctx.tenant_id, clean_phone)
            if contact:
                account_name = None
                if contact.account_id:
                    acc = await self.session.get(Account, contact.account_id)
                    if acc:
                        account_name = acc.name
                return {
                    "is_duplicate_warning": False,
                    "has_existing_contact": True,
                    "existing_contact_id": str(contact.id),
                    "existing_contact_name": contact.full_name,
                    "existing_company": account_name,
                    "notice_message": (
                        f"Note: '{contact.full_name}' is already an existing Contact at '{account_name or 'N/A'}'. "
                        f"Converting this inquiry will automatically link to the existing Contact without creating duplicates."
                    ),
                }
            elif converted_leads:
                cl = converted_leads[0]
                return {
                    "is_duplicate_warning": False,
                    "has_existing_contact": True,
                    "existing_lead_id": str(cl.id),
                    "existing_lead_name": cl.name,
                    "existing_company": cl.company,
                    "notice_message": (
                        f"Note: '{cl.name}' is already an established Contact/Account in this organization (previously converted). "
                        f"Converting this inquiry will automatically link without creating duplicates."
                    ),
                }

        return None

    async def create_lead(
        self,
        ctx: RequestContext,
        name: str,
        company: Optional[str] = None,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        industry: Optional[str] = None,
        source: Optional[str] = "Manual",
        score: int = 50,
        assigned_to: Optional[str | uuid.UUID] = None,
        title: Optional[str] = None,
        website: Optional[str] = None,
        allow_separate_inquiry: bool = False,
        product_id: Optional[str | uuid.UUID] = None,
        interested_product: Optional[str] = None,
    ) -> Lead:
        if not name or not name.strip():
            raise BadRequestError("Lead name is required")

        from datetime import datetime, timezone, timedelta
        from backend.app.data.models.lead import LeadSignal
        from backend.app.data.models.deal import Product
        from sqlalchemy import select, func
        import re
        now = datetime.now(timezone.utc)

        # 1. Resolve product: find or auto-create typed product in catalog
        resolved_product_id = None
        resolved_product_name = None

        if product_id:
            try:
                p_uuid = uuid.UUID(str(product_id))
                prod = await self.session.get(Product, p_uuid)
                if prod and prod.organization_id == ctx.tenant_uuid:
                    resolved_product_id = prod.id
                    resolved_product_name = prod.name
            except (ValueError, TypeError):
                resolved_product_id = None

        if not resolved_product_id and interested_product and interested_product.strip():
            clean_pname = interested_product.strip()
            stmt = select(Product).where(
                Product.organization_id == ctx.tenant_uuid,
                func.lower(func.trim(Product.name)) == clean_pname.lower(),
                Product.deleted_at.is_(None),
            )
            res = await self.session.execute(stmt)
            existing_prod = res.scalars().first()
            if existing_prod:
                resolved_product_id = existing_prod.id
                resolved_product_name = existing_prod.name
            else:
                # Salesperson typed a new product: create in products table so it's permanently stored and shows in dropdown!
                sku_clean = re.sub(r'[^A-Z0-9]', '', clean_pname.upper())[:6] or "PROD"
                new_sku = f"SKU-{sku_clean}-{uuid.uuid4().hex[:4].upper()}"
                new_prod = Product(
                    organization_id=ctx.tenant_uuid,
                    name=clean_pname,
                    sku=new_sku,
                    category="General",
                    price=0.0,
                    currency="USD",
                    is_active=True,
                )
                self.session.add(new_prod)
                await self.session.flush()
                resolved_product_id = new_prod.id
                resolved_product_name = new_prod.name

        clean_email = email.lower().strip() if email and email.strip() else None
        clean_name = name.strip() if name and name.strip() else None
        clean_company = company.strip() if company and company.strip() else None
        clean_title = title.strip() if title and title.strip() else None
        clean_website = website.strip() if website and website.strip() else None
        clean_prod = (resolved_product_name or (interested_product.strip() if interested_product else "")).strip().lower()

        prior_context = {}
        is_separate_inquiry = False
        is_returning_contact = False
        is_cross_sell = False

        clean_phone = phone.strip() if phone and phone.strip() else None

        existing_leads_map = {}
        if clean_email:
            for l in await self.lead_repo.list_by_email(clean_email, ctx.tenant_id):
                existing_leads_map[l.id] = l
        if clean_phone:
            for l in await self.lead_repo.list_by_phone(clean_phone, ctx.tenant_id):
                existing_leads_map[l.id] = l
        existing_leads = list(existing_leads_map.values())

        # If clean_name is provided, only match leads that also match the name
        # (different people with the same name and different emails/phones are distinct leads)
        if clean_name and existing_leads:
            existing_leads = [
                l for l in existing_leads
                if l.name and l.name.strip().lower() == clean_name.lower()
            ]

        if existing_leads:
            active_leads = [
                l for l in existing_leads
                if l.status not in ("Converted", "Expired", "Lost", "Disqualified")
            ]

            if active_leads:
                active_lead = active_leads[0]
                created_at = active_lead.created_at
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)
                age_days = (now - created_at).total_seconds() / 86400.0

                def norm_prod(p):
                    return re.sub(r'[^a-z0-9]', '', (p or "").lower())

                new_norm = norm_prod(clean_prod)
                existing_norm = norm_prod(active_lead.interested_product)
                is_diff_product = bool(new_norm and existing_norm and new_norm != existing_norm)

                if not is_diff_product and age_days < 30:
                    if not allow_separate_inquiry:
                        raise ConflictError(
                            f"A lead matching '{active_lead.name}' already exists in this organization "
                            f"(status: '{active_lead.status}', company: '{active_lead.company or 'N/A'}', product: '{active_lead.interested_product or 'N/A'}'). "
                            f"Please confirm a separate inquiry before proceeding."
                        )
                    else:
                        # Legitimate separate inquiry confirmed: preserve existing lead intact!
                        is_separate_inquiry = True
                        prior_context = {
                            "company": active_lead.company,
                            "industry": active_lead.industry,
                            "phone": active_lead.phone,
                        }
                else:
                    if is_diff_product:
                        is_cross_sell = True
                    else:
                        is_returning_contact = True
                    prior_context = {
                        "company": active_lead.company,
                        "industry": active_lead.industry,
                        "phone": active_lead.phone,
                    }

        # Check if this email matches an existing Contact in the database
        if clean_email:
            contact = await self.contact_repo.get_by_normalized_email(ctx.tenant_id, clean_email)
            if contact:
                is_returning_contact = True
                if not prior_context.get("phone") and contact.phone:
                    prior_context["phone"] = contact.phone
                if not clean_company and contact.account_id:
                    acc = await self.session.get(Account, contact.account_id)
                    if acc and acc.name:
                        clean_company = acc.name

        # Inherit useful context if not provided
        if not clean_company or clean_company == "Enterprise Corp":
            clean_company = prior_context.get("company") or clean_company or "Enterprise Corp"
        if not industry:
            industry = prior_context.get("industry") or industry
        if not phone:
            phone = prior_context.get("phone") or phone

        assign_uuid = None
        candidate_id = assigned_to or ctx.user_uuid
        if candidate_id:
            try:
                candidate_uuid = candidate_id if isinstance(candidate_id, uuid.UUID) else uuid.UUID(str(candidate_id))
                user_exists = await self.session.get(User, candidate_uuid)
                if user_exists:
                    assign_uuid = candidate_uuid
            except (ValueError, TypeError):
                assign_uuid = None

        lead = Lead(
            organization_id=ctx.tenant_uuid,
            name=clean_name or name.strip(),
            company=clean_company,
            title=clean_title,
            website=clean_website,
            email=clean_email,
            phone=phone,
            industry=industry,
            source=source,
            score=score,
            status="New",
            assigned_to=assign_uuid,
            product_id=resolved_product_id,
            interested_product=resolved_product_name or (interested_product.strip() if interested_product else None),
        )
        created = await self.lead_repo.create(lead, ctx.tenant_id)

        # Record signals for tracking
        if is_cross_sell:
            signal = LeadSignal(
                lead_id=created.id,
                signal_type="cross_sell_inquiry",
                signal_value=f"Cross-sell inquiry for '{resolved_product_name}'. Customer also has prior lead history.",
                score=15,
                source="System",
            )
            self.session.add(signal)
            await self.session.flush()
        elif is_separate_inquiry:
            signal = LeadSignal(
                lead_id=created.id,
                signal_type="separate_inquiry",
                signal_value=f"Confirmed separate inquiry for '{clean_email}'. Prior lead retained.",
                score=10,
                source="System",
            )
            self.session.add(signal)
            await self.session.flush()
        elif is_returning_contact:
            signal = LeadSignal(
                lead_id=created.id,
                signal_type="returning_contact",
                signal_value=f"Returning contact. Preserved context from prior interaction ({prior_context.get('company')}).",
                score=15,
                source="System",
            )
            self.session.add(signal)
            await self.session.flush()

        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="CREATE",
            resource_type="lead",
            resource_id=created.id,
            new_values={"name": name, "company": company, "email": clean_email},
        )
        return created

    async def cleanup_stale_leads(self, ctx: RequestContext, retention_days: int = 30) -> int:
        """
        Soft-deletes leads older than retention_days (default 30 days) that are
        not converted, allowing clean pipeline hygiene and returning customer re-entry.
        """
        from datetime import datetime, timezone, timedelta
        from sqlalchemy import select
        cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)

        stmt = (
            select(Lead)
            .where(
                Lead.organization_id == ctx.tenant_uuid,
                Lead.deleted_at.is_(None),
                Lead.created_at < cutoff,
                ~Lead.status.in_(["Converted"]),
            )
        )
        res = await self.session.execute(stmt)
        stale_leads = res.scalars().all()
        now = datetime.now(timezone.utc)
        count = 0
        for l in stale_leads:
            l.deleted_at = now
            count += 1
        await self.session.flush()
        return count

    async def convert_lead(
        self,
        ctx: RequestContext,
        lead_id: str | uuid.UUID,
        deal_name: Optional[str] = None,
        deal_amount: float = 50000.0,
        company_name: Optional[str] = None,
        contact_name: Optional[str] = None,
        contact_email: Optional[str] = None,
        contact_phone: Optional[str] = None,
        contact_title: Optional[str] = None,
        website: Optional[str] = None,
        create_deal: bool = True,
    ) -> Dict[str, Any]:
        """
        Atomic multi-record lead conversion:
        1. Validates lead existence & access
        2. Creates or links Account using lead company name
        3. Deduplicates and reuses or creates Contact using normalized email
        4. Optionally creates Deal in pipeline (if create_deal=True)
        5. Marks Lead as 'Converted'
        6. Writes to lead_conversions and audit_logs
        """
        lead = await self.get_lead(ctx, lead_id)
        if lead.status == "Converted":
            raise ConflictError("This lead has already been converted")

        target_company = (company_name or getattr(lead, "company", None) or getattr(lead, "industry", None) or lead.name or "Enterprise Account").strip()

        # 1. Account (find existing or create)
        account = await self.account_repo.get_by_name(target_company, ctx.tenant_id)
        if not account:
            account = Account(
                organization_id=ctx.tenant_uuid,
                name=target_company,
                industry=lead.industry or "Technology",
                website=website or getattr(lead, "website", None),
                phone=contact_phone or lead.phone,
                address=getattr(lead, "location", None) or getattr(lead, "city", None) or "India",
                status="active",
            )
            account = await self.account_repo.create(account, ctx.tenant_id)
        else:
            if (website or getattr(lead, "website", None)) and not account.website:
                account.website = website or getattr(lead, "website", None)
                await self.session.flush()

        # 2. Contact deduplication: prevent duplicate Contacts using normalized email address
        target_email = (contact_email or lead.email or "").strip().lower()
        contact = None
        if target_email:
            contact = await self.contact_repo.get_by_normalized_email(
                tenant_id=ctx.tenant_id,
                email=target_email,
                account_id=account.id,
            )
            if contact:
                # Reuse existing contact and augment if new fields present
                if (contact_phone or lead.phone) and not contact.phone:
                    contact.phone = contact_phone or lead.phone
                if (contact_title or getattr(lead, "title", None)) and not contact.title:
                    contact.title = contact_title or getattr(lead, "title", None)
                await self.session.flush()

        if not contact:
            full_contact_name = (contact_name or lead.name or "Contact").strip()
            name_parts = full_contact_name.split(" ", 1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ""

            contact = Contact(
                account_id=account.id,
                first_name=first_name,
                last_name=last_name,
                email=target_email or None,
                phone=contact_phone or lead.phone,
                title=contact_title or getattr(lead, "title", None) or None,
            )
            self.session.add(contact)
            await self.session.flush()

        from backend.app.data.models.user import User
        converter = await self.session.get(User, ctx.user_uuid) if ctx.user_uuid else None
        converter_name = converter.name if converter else None

        opp = None
        deal = None
        if create_deal:
            # 3. Opportunity & Deal
            from backend.app.data.models.deal import Opportunity
            deal_title = deal_name or f"{target_company} - Strategic Expansion"
            deal_owner = lead.assigned_to or ctx.user_uuid
            opp = Opportunity(
                organization_id=ctx.tenant_uuid,
                account_id=account.id,
                contact_id=contact.id,
                owner_id=deal_owner,
                name=deal_title,
                amount=deal_amount,
                stage="qualified",
                probability=50,
            )
            self.session.add(opp)
            await self.session.flush()

            deal = Deal(
                organization_id=ctx.tenant_uuid,
                account_id=account.id,
                opportunity_id=opp.id,
                name=deal_title,
                amount=deal_amount,
                stage="Qualified",
                status="open",
                owner_id=deal_owner,
            )
            deal = await self.deal_repo.create(deal, ctx.tenant_id)

        # 4. Mark lead as Converted
        await self.lead_repo.update_scoped(
            record_id=lead.id,
            tenant_id=ctx.tenant_id,
            update_data={"status": "Converted"},
        )

        # 5. Conversion record
        conversion = await self.lead_repo.record_conversion(
            lead_id=lead.id,
            account_id=account.id,
            opportunity_id=opp.id if opp else None,
            conversion_type="standard",
            notes=f"Converted by user {ctx.user_id}",
        )

        # 6. Audit log
        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="CONVERT",
            resource_type="lead",
            resource_id=lead.id,
            new_values={
                "account_id": str(account.id),
                "deal_id": str(deal.id) if deal else None,
                "amount": deal_amount if deal else 0.0,
            },
        )

        return {
            "status": "success",
            "message": "Lead converted successfully",
            "lead_id": str(lead.id),
            "account_id": str(account.id),
            "account_name": str(account.name),
            "account_industry": account.industry,
            "account_phone": account.phone,
            "contact_id": str(contact.id),
            "contact_name": f"{contact.first_name} {contact.last_name}".strip(),
            "contact_email": contact.email,
            "contact_phone": contact.phone,
            "contact_title": contact.title,
            "deal_id": str(deal.id) if deal else None,
            "deal_name": deal.name if deal else None,
            "deal_amount": float(deal.amount) if deal else None,
            "deal_stage": deal.stage if deal else None,
            "owner": converter_name,
            "owner_id": str(deal.owner_id) if (deal and deal.owner_id) else None,
            "conversion_id": str(conversion.id),
        }

    async def delete_lead(self, ctx: RequestContext, lead_id: str | uuid.UUID) -> bool:
        lead = await self.get_lead(ctx, lead_id)
        is_team_lead = False
        if ctx.is_manager:
            mgr_team = await self.team_repo.get_by_manager(ctx.user_uuid, ctx.tenant_id)
            if mgr_team and lead.assigned_to:
                team_users = await self.user_repo.list_by_team(mgr_team.id, ctx.tenant_id)
                team_user_ids = {u.id for u in team_users} | {ctx.user_uuid}
                is_team_lead = lead.assigned_to in team_user_ids

        PermissionService.check_can_delete_lead(
            ctx=ctx,
            lead_tenant_id=str(lead.organization_id),
            is_team_lead=is_team_lead,
        )

        await self.lead_repo.delete_scoped(lead.id, ctx.tenant_id, soft_delete=True)
        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="DELETE",
            resource_type="lead",
            resource_id=lead.id,
        )
        return True

    async def assign_lead(
        self,
        ctx: RequestContext,
        lead_id: str | uuid.UUID,
        assignee_id: str | uuid.UUID,
    ) -> Lead:
        """
        Transfers lead ownership with role hierarchy enforcement:
        - Owner: can assign any organization lead to any Manager or Salesperson (or self).
        - Manager: can assign their team's leads to any Salesperson within their active team (or self).
        - Salesperson: forbidden from reassigning leads.
        """
        if ctx.is_salesperson:
            raise ForbiddenError("Salespersons are not authorized to reassign leads")

        lead = await self.get_lead(ctx, lead_id)

        try:
            assignee = await self.user_repo.get_by_id_scoped(assignee_id, ctx.tenant_id)
        except RecordNotFoundError:
            raise NotFoundError(f"Assignee user '{assignee_id}' does not exist in this organization")

        # Check if lead is already assigned to this user
        if lead.assigned_to and str(lead.assigned_to) == str(assignee.id):
            raise BadRequestError(
                f"Lead '{lead.name}' is already assigned to {assignee.name}. Please select a different team member."
            )

        assignee_role = assignee.role_name.lower().strip()

        if ctx.is_manager:
            if assignee_role in ("owner", "admin"):
                raise ForbiddenError("Managers cannot assign leads to the Owner")
            if assignee_role == "manager" and str(assignee.id) != str(ctx.user_uuid):
                raise ForbiddenError("Managers cannot assign leads to other Managers")

            mgr_team = await self.team_repo.get_active_manager_team(ctx.user_id, ctx.tenant_id)
            if not mgr_team:
                raise ForbiddenError("Manager has no active team")

            is_in_team = (
                str(assignee.id) == str(ctx.user_uuid) or
                await self.team_repo.is_user_in_team(
                    user_id=assignee.id, team_id=mgr_team.id, tenant_id=ctx.tenant_id
                )
            )
            if not is_in_team:
                raise ForbiddenError("Managers can only assign leads to salespersons within their active team")

        # Persist assignment
        updated_lead = await self.lead_repo.update_scoped(
            record_id=lead.id,
            tenant_id=ctx.tenant_id,
            update_data={"assigned_to": assignee.id},
        )

        # If this lead was previously converted, also transfer its Opportunity and Deals to the new owner!
        from backend.app.data.models.lead import LeadConversion
        from backend.app.data.models.deal import Deal, Opportunity
        from backend.app.data.models.account import Account
        from sqlalchemy import select

        affected_deal_ids = []
        conv_stmt = select(LeadConversion).where(LeadConversion.lead_id == lead.id)
        conversions = (await self.session.execute(conv_stmt)).scalars().all()
        for conv in conversions:
            if conv.opportunity_id:
                opp = await self.session.get(Opportunity, conv.opportunity_id)
                if opp:
                    opp.owner_id = assignee.id
                deal_stmt = select(Deal).where(Deal.opportunity_id == conv.opportunity_id)
                deals = (await self.session.execute(deal_stmt)).scalars().all()
                for d in deals:
                    d.owner_id = assignee.id
                    affected_deal_ids.append(str(d.id))

        setattr(updated_lead, "_affected_deal_ids", list(set(affected_deal_ids)))

        await self.audit_repo.record_event(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action="ASSIGN_LEAD",
            resource_type="lead",
            resource_id=lead.id,
            new_values={
                "assigned_to": str(assignee.id),
                "assignee_name": assignee.name,
                "assigned_by": str(ctx.user_id),
            },
        )
        return updated_lead

    async def assign_leads(
        self,
        ctx: RequestContext,
        lead_ids: List[str | uuid.UUID],
        assignee_id: str | uuid.UUID,
    ) -> List[Lead]:
        try:
            assignee = await self.user_repo.get_by_id_scoped(assignee_id, ctx.tenant_id)
        except RecordNotFoundError:
            raise NotFoundError(f"Assignee user '{assignee_id}' does not exist in this organization")

        leads = [await self.get_lead(ctx, lid) for lid in lead_ids]
        already_assigned = [l for l in leads if l.assigned_to and str(l.assigned_to) == str(assignee.id)]
        if len(already_assigned) == len(leads):
            lead_names = ", ".join([f"'{l.name}'" for l in leads[:2]])
            raise BadRequestError(
                f"Lead {lead_names} is already assigned to {assignee.name}. Please select a different team member."
            )

        updated_leads = []
        for l in leads:
            if l.assigned_to and str(l.assigned_to) == str(assignee.id):
                continue
            updated = await self.assign_lead(ctx, l.id, assignee_id)
            updated_leads.append(updated)
        return updated_leads

