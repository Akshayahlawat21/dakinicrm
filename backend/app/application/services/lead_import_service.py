import io
import os
import re
import csv
import copy
import uuid
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from backend.app.application.context import RequestContext
from backend.app.application.exceptions import BadRequestError, NotFoundError, ForbiddenError
from backend.app.data.models.lead import Lead
from backend.app.data.models.lead_import import LeadImportBatch


HEADER_MAPPINGS = {
    "name": ["name", "full name", "lead name", "contact name", "customer name", "fullname"],
    "email": ["email", "email address", "work email", "contact email", "e-mail"],
    "phone": ["phone", "phone number", "mobile", "mobile number", "contact number", "cell", "telephone"],
    "company": ["company", "company name", "organization", "account", "business name", "org"],
    "industry": ["industry", "sector", "vertical"],
    "title": ["title", "job title", "role", "designation", "position"],
    "website": ["website", "url", "domain", "web"],
    "interested_product": ["interested_product", "product", "product name", "interested product", "solution", "product interest"],
    "source": ["source", "lead source", "channel", "origin"],
    "score": ["score", "lead score", "points"],
    "assigned_to": ["assigned_to", "owner", "lead_owner", "assigned to", "lead owner", "assignee", "rep"],
}


def _normalize_header(header: str) -> str:
    """Matches CSV header variant to canonical Lead model field name."""
    clean = re.sub(r"[_\-\s]+", " ", str(header).lower().strip())
    for canonical, aliases in HEADER_MAPPINGS.items():
        if clean in aliases or clean == canonical:
            return canonical
    return clean.replace(" ", "_")


def _norm_prod(val: Optional[str]) -> str:
    """Normalizes product string for cross-sell vs duplicate comparisons."""
    return re.sub(r"[^a-z0-9]", "", (val or "").lower().strip())


def _clean_phone(phone: Optional[str]) -> str:
    """Removes non-digits except leading +."""
    if not phone:
        return ""
    p = str(phone).strip()
    has_plus = p.startswith("+")
    digits = re.sub(r"\D", "", p)
    return f"+{digits}" if has_plus else digits


EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class LeadImportService:
    """High-performance batch lead ingestion service with product-aware deduplication."""

    def __init__(self, session: AsyncSession):
        self.session = session

    @staticmethod
    def _build_lead_from_data(
        organization_id: uuid.UUID,
        batch_id: uuid.UUID,
        data: Dict[str, Any],
        now: datetime,
        fallback_assignee: Optional[uuid.UUID] = None,
        product_id: Optional[uuid.UUID] = None,
    ) -> Lead:
        """Builds a Lead ORM instance from normalized import candidate data."""
        raw_assigned = data.get("assigned_to")
        if isinstance(raw_assigned, uuid.UUID):
            assigned_uuid = raw_assigned
        elif raw_assigned:
            try:
                assigned_uuid = uuid.UUID(str(raw_assigned))
            except ValueError:
                assigned_uuid = fallback_assignee
        else:
            assigned_uuid = fallback_assignee

        resolved_product_id = product_id
        if not resolved_product_id and data.get("product_id"):
            try:
                resolved_product_id = uuid.UUID(str(data.get("product_id")))
            except (ValueError, TypeError):
                resolved_product_id = None

        return Lead(
            id=uuid.uuid4(),
            organization_id=organization_id,
            assigned_to=assigned_uuid,
            import_batch_id=batch_id,
            name=data.get("name") or "Lead",
            company=data.get("company"),
            email=data.get("email"),
            phone=data.get("phone"),
            industry=data.get("industry"),
            title=data.get("title"),
            website=data.get("website"),
            source=data.get("source") or "Bulk Import",
            score=int(data.get("score")) if str(data.get("score") or "").isdigit() else 50,
            status="New",
            product_id=resolved_product_id,
            interested_product=data.get("interested_product"),
            created_at=now,
            updated_at=now,
        )

    @staticmethod
    def _parse_file_rows(file_content: bytes, file_name: str) -> List[List[str]]:
        ext = os.path.splitext(file_name or "")[1].lower()

        def _format_cell(val: Any) -> str:
            if val is None:
                return ""
            if isinstance(val, float) and val.is_integer():
                return str(int(val))
            return str(val).strip()

        if ext == ".xlsx":
            try:
                import openpyxl
            except ImportError:
                raise BadRequestError("openpyxl is required to parse .xlsx files.")
            try:
                wb = openpyxl.load_workbook(io.BytesIO(file_content), read_only=True, data_only=True)
                sheet = wb.active
                if sheet is None:
                    return []
                rows = []
                for row in sheet.iter_rows(values_only=True):
                    rows.append([_format_cell(c) for c in row])
                return rows
            except Exception as e:
                raise BadRequestError(f"Failed to parse Excel (.xlsx) file: {str(e)}")

        elif ext == ".xls":
            try:
                import xlrd
            except ImportError:
                raise BadRequestError("xlrd is required to parse .xls files.")
            try:
                book = xlrd.open_workbook(file_contents=file_content)
                sheet = book.sheet_by_index(0)
                rows = []
                for r_idx in range(sheet.nrows):
                    row_vals = sheet.row_values(r_idx)
                    rows.append([_format_cell(c) for c in row_vals])
                return rows
            except Exception as e:
                raise BadRequestError(f"Failed to parse Excel (.xls) file: {str(e)}")

        else:
            # Default to CSV decoder
            try:
                text = file_content.decode("utf-8-sig")
            except UnicodeDecodeError:
                try:
                    text = file_content.decode("utf-8")
                except UnicodeDecodeError:
                    text = file_content.decode("latin-1")

            csv_reader = csv.reader(io.StringIO(text))
            return [list(r) for r in csv_reader]

    async def import_leads_csv(
        self,
        ctx: RequestContext,
        file_content: bytes,
        file_name: str,
    ) -> Dict[str, Any]:
        """Backward-compatible alias for import_leads_file."""
        return await self.import_leads_file(ctx, file_content, file_name)

    async def import_leads_file(
        self,
        ctx: RequestContext,
        file_content: bytes,
        file_name: str,
    ) -> Dict[str, Any]:
        """
        Executes end-to-end bulk lead import for CSV, XLSX, and XLS files:
        1. Creates batch audit record (status: 'processing')
        2. Streams & parses rows
        3. Validates required fields and formatting
        4. Detects intra-file and database-level duplicates (product-aware)
        5. Batch-inserts clean leads (chunks of 500)
        6. Updates batch audit record and returns summary metrics
        """
        now = datetime.now(timezone.utc)
        batch_id = uuid.uuid4()

        # 1. Initialize batch audit record
        batch = LeadImportBatch(
            id=batch_id,
            organization_id=ctx.tenant_uuid,
            user_id=ctx.user_uuid if ctx.user_uuid else None,
            file_name=file_name,
            status="processing",
            total_rows=0,
            inserted_count=0,
            duplicate_count=0,
            error_count=0,
            error_log=[],
            created_at=now,
        )
        self.session.add(batch)
        await self.session.flush()

        # 2. Parse file rows (supports CSV, XLSX, and XLS)
        rows = self._parse_file_rows(file_content, file_name)
        if not rows or len(rows) < 2:
            batch.status = "failed"
            batch.error_log = [{"row": 0, "error": "File is empty or missing data rows."}]
            await self.session.commit()
            raise BadRequestError("Uploaded file is empty or missing header/data rows.")

        raw_headers = rows[0]
        mapped_headers = [_normalize_header(h) for h in raw_headers]
        data_rows = rows[1:]
        total_rows = len(data_rows)
        batch.total_rows = total_rows

        # 3. Stream & validate rows into candidates
        from backend.app.data.models.user import User
        user_rows = (await self.session.execute(
            select(User.id, User.email, User.name).where(
                User.organization_id == ctx.tenant_uuid,
                User.deleted_at.is_(None)
            )
        )).all()
        user_lookup: Dict[str, uuid.UUID] = {}
        for uid, uemail, uname in user_rows:
            if uemail:
                user_lookup[uemail.lower().strip()] = uid
            if uname:
                user_lookup[uname.lower().strip()] = uid
            user_lookup[str(uid).lower().strip()] = uid

        valid_candidates: List[Dict[str, Any]] = []
        errors: List[Dict[str, Any]] = []
        in_file_duplicates = 0

        seen_in_file_emails: set = set()
        seen_in_file_phones: set = set()

        for idx, r in enumerate(data_rows, start=2):
            if not any(cell.strip() for cell in r if cell):
                continue  # skip completely blank lines

            row_dict = {}
            for col_idx, val in enumerate(r):
                if col_idx < len(mapped_headers):
                    key = mapped_headers[col_idx]
                    row_dict[key] = val.strip() if val else None

            row_num = idx
            name = (row_dict.get("name") or "").strip()
            email = (row_dict.get("email") or "").strip().lower()
            phone = _clean_phone(row_dict.get("phone"))
            product = (row_dict.get("interested_product") or "").strip()

            # Rule 1: Name is required
            if not name:
                errors.append({"row": row_num, "error": "Missing required field: 'name' is empty."})
                continue

            # Rule 2: At least Email or Phone required
            if not email and not phone:
                errors.append({"row": row_num, "name": name, "error": "Missing contact method: Must provide at least an email or phone number."})
                continue

            # Rule 3: Email syntax validation
            if email and not EMAIL_REGEX.match(email):
                errors.append({"row": row_num, "name": name, "email": email, "error": f"Invalid email format: '{email}'."})
                continue

            owner_raw = (row_dict.get("assigned_to") or "").strip().lower()
            assigned_uuid = user_lookup.get(owner_raw) if owner_raw else None
            if not assigned_uuid and ctx.user_uuid:
                assigned_uuid = ctx.user_uuid

            lead_payload = {
                "name": name,
                "company": row_dict.get("company"),
                "email": email or None,
                "phone": phone or None,
                "industry": row_dict.get("industry"),
                "title": row_dict.get("title"),
                "website": row_dict.get("website"),
                "source": row_dict.get("source") or "Bulk Import",
                "score": int(row_dict.get("score")) if str(row_dict.get("score") or "").isdigit() else 50,
                "interested_product": product or None,
                "assigned_to": str(assigned_uuid) if assigned_uuid else None,
            }

            # Rule 4: Intra-file duplicate check
            norm_p = _norm_prod(product)
            if email and (email, norm_p) in seen_in_file_emails:
                in_file_duplicates += 1
                errors.append({
                    "row": row_num,
                    "name": name,
                    "email": email or phone or None,
                    "is_duplicate": True,
                    "allowed": False,
                    "lead_data": lead_payload,
                    "error": f"Duplicate entry within CSV file for email '{email}' and product '{product}'.",
                })
                continue
            if phone and (phone, norm_p) in seen_in_file_phones:
                in_file_duplicates += 1
                errors.append({
                    "row": row_num,
                    "name": name,
                    "email": email or phone or None,
                    "is_duplicate": True,
                    "allowed": False,
                    "lead_data": lead_payload,
                    "error": f"Duplicate entry within CSV file for phone '{phone}' and product '{product}'.",
                })
                continue

            if email:
                seen_in_file_emails.add((email, norm_p))
            if phone:
                seen_in_file_phones.add((phone, norm_p))

            valid_candidates.append({
                "row_num": row_num,
                "lead_data": lead_payload,
                **lead_payload,
                "assigned_to": assigned_uuid,
                "_norm_prod": norm_p,
            })

        # 4. Product-Aware Database Deduplication Check (Single Query)
        emails_to_check = [c["email"] for c in valid_candidates if c["email"]]
        phones_to_check = [c["phone"] for c in valid_candidates if c["phone"]]

        existing_db_records = []
        if emails_to_check or phones_to_check:
            conditions = []
            if emails_to_check:
                conditions.append(func.lower(Lead.email).in_(emails_to_check))
            if phones_to_check:
                conditions.append(Lead.phone.in_(phones_to_check))

            stmt = select(
                func.lower(Lead.email),
                Lead.phone,
                func.lower(Lead.interested_product),
                Lead.name,
            ).where(
                Lead.organization_id == ctx.tenant_uuid,
                Lead.deleted_at.is_(None),
                Lead.status.notin_(["Converted", "Lost", "Disqualified"]),
                or_(*conditions),
            )
            res = await self.session.execute(stmt)
            existing_db_records = res.all()

        existing_email_prod_set = set()
        existing_phone_prod_set = set()
        for e_email, e_phone, e_prod, _ in existing_db_records:
            norm_e_prod = _norm_prod(e_prod)
            if e_email:
                existing_email_prod_set.add((e_email.lower().strip(), norm_e_prod))
            if e_phone:
                existing_phone_prod_set.add((_clean_phone(e_phone), norm_e_prod))

        # 4.5. Resolve & Auto-Create Products in Catalog
        from backend.app.data.models.deal import Product

        raw_prod_names = {
            (c.get("interested_product") or "").strip()
            for c in valid_candidates
            if (c.get("interested_product") or "").strip()
        }

        product_id_lookup: Dict[str, uuid.UUID] = {}
        if raw_prod_names:
            prod_stmt = select(Product).where(
                Product.organization_id == ctx.tenant_uuid,
                Product.deleted_at.is_(None),
            )
            existing_org_prods = (await self.session.execute(prod_stmt)).scalars().all()
            for p in existing_org_prods:
                product_id_lookup[p.name.lower().strip()] = p.id

            new_prods_to_create = []
            for raw_name in raw_prod_names:
                norm_key = raw_name.lower().strip()
                if norm_key not in product_id_lookup:
                    sku_clean = re.sub(r'[^A-Z0-9]', '', raw_name.upper())[:6] or "PROD"
                    new_sku = f"SKU-{sku_clean}-{uuid.uuid4().hex[:4].upper()}"
                    new_p = Product(
                        id=uuid.uuid4(),
                        organization_id=ctx.tenant_uuid,
                        name=raw_name,
                        sku=new_sku,
                        category="Imported",
                        price=0.0,
                        currency="USD",
                        is_active=True,
                    )
                    new_prods_to_create.append(new_p)
                    product_id_lookup[norm_key] = new_p.id

            if new_prods_to_create:
                self.session.add_all(new_prods_to_create)
                await self.session.flush()

        to_insert: List[Lead] = []
        db_duplicate_count = 0

        for candidate in valid_candidates:
            c_email = candidate["email"]
            c_phone = candidate["phone"]
            c_norm_p = candidate["_norm_prod"]

            # Exact duplicate check (Same person + Same product inquiry)
            is_dup = False
            if c_email and (c_email, c_norm_p) in existing_email_prod_set:
                is_dup = True
            elif c_phone and (c_phone, c_norm_p) in existing_phone_prod_set:
                is_dup = True

            if is_dup:
                db_duplicate_count += 1
                errors.append({
                    "row": candidate["row_num"],
                    "name": candidate["name"],
                    "email": candidate["email"] or candidate["phone"] or None,
                    "is_duplicate": True,
                    "allowed": False,
                    "lead_data": candidate["lead_data"],
                    "error": f"Duplicate skipped: Active lead already exists for '{candidate['name']}' inquiring about '{candidate['interested_product'] or 'General'}'.",
                })
            else:
                prod_name = (candidate["lead_data"].get("interested_product") or "").strip()
                matched_product_id = product_id_lookup.get(prod_name.lower().strip()) if prod_name else None

                new_lead = self._build_lead_from_data(
                    organization_id=ctx.tenant_uuid,
                    batch_id=batch_id,
                    data=candidate["lead_data"],
                    now=now,
                    fallback_assignee=ctx.user_uuid,
                    product_id=matched_product_id,
                )
                to_insert.append(new_lead)

        # 5. Batch insert valid leads (chunks of 500)
        chunk_size = 500
        for i in range(0, len(to_insert), chunk_size):
            chunk = to_insert[i : i + chunk_size]
            self.session.add_all(chunk)
            await self.session.flush()

        # 6. Update batch audit record
        inserted_count = len(to_insert)
        total_duplicate_count = in_file_duplicates + db_duplicate_count
        error_count = len(errors) - total_duplicate_count

        batch.inserted_count = inserted_count
        batch.duplicate_count = total_duplicate_count
        batch.error_count = error_count
        batch.error_log = errors  # store full error and duplicate diagnostics
        batch.status = "completed"

        await self.session.commit()

        return {
            "batch_id": str(batch_id),
            "file_name": file_name,
            "total_rows": total_rows,
            "inserted_count": inserted_count,
            "duplicate_count": total_duplicate_count,
            "error_count": error_count,
            "status": "completed",
            "error_sample": errors,
        }

    async def get_import_history(
        self,
        ctx: RequestContext,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """
        Retrieves historical lead import batches with RBAC scoping:
        - Owner: all tenant batches
        - Manager: manager's batches + team members' batches
        - Salesperson: strictly caller's batches
        """
        from backend.app.data.models.user import User
        from backend.app.data.repositories.team_repository import TeamRepository
        from backend.app.data.repositories.user_repository import UserRepository

        conditions = [
            LeadImportBatch.organization_id == ctx.tenant_uuid,
        ]

        if ctx.is_salesperson:
            conditions.append(LeadImportBatch.user_id == ctx.user_uuid)
        elif ctx.is_manager:
            team_repo = TeamRepository(self.session)
            user_repo = UserRepository(self.session)
            mgr_team = await team_repo.get_active_manager_team(ctx.user_id, ctx.tenant_id)
            if mgr_team:
                team_users = await user_repo.list_by_team(mgr_team.id, ctx.tenant_id)
                team_user_ids = [u.id for u in team_users] + [ctx.user_uuid]
                conditions.append(LeadImportBatch.user_id.in_(team_user_ids))
            else:
                conditions.append(LeadImportBatch.user_id == ctx.user_uuid)

        stmt = (
            select(
                LeadImportBatch,
                User.name.label("user_name"),
                User.email.label("user_email"),
                User.role_name.label("user_role"),
            )
            .outerjoin(User, LeadImportBatch.user_id == User.id)
            .where(*conditions)
            .order_by(LeadImportBatch.created_at.desc())
            .limit(limit)
        )
        res = await self.session.execute(stmt)
        rows = res.all()

        history = []
        for batch, u_name, u_email, u_role in rows:
            history.append({
                "batch_id": str(batch.id),
                "file_name": batch.file_name,
                "total_rows": batch.total_rows,
                "inserted_count": batch.inserted_count,
                "duplicate_count": batch.duplicate_count,
                "error_count": batch.error_count,
                "status": batch.status,
                "created_at": batch.created_at.isoformat() if batch.created_at else None,
                "user_id": str(batch.user_id) if batch.user_id else None,
                "user_name": u_name or (u_email.split("@")[0] if u_email else "System"),
                "user_role": u_role or "User",
                "error_sample": batch.error_log or [],
            })
        return history

    async def allow_duplicate_leads(
        self,
        ctx: RequestContext,
        batch_id: str,
        row_numbers: Optional[List[int]] = None,
        allow_all: bool = False,
    ) -> Dict[str, Any]:
        """
        Force-inserts user-approved duplicate rows from a prior bulk import batch.
        Enforces strict tenant and RBAC access checks on the batch.
        """
        from backend.app.data.models.user import User
        from backend.app.data.repositories.team_repository import TeamRepository
        from backend.app.data.repositories.user_repository import UserRepository

        try:
            batch_uuid = uuid.UUID(str(batch_id))
        except ValueError:
            raise BadRequestError("Invalid batch ID format.")

        stmt = (
            select(
                LeadImportBatch,
                User.name.label("user_name"),
                User.email.label("user_email"),
                User.role_name.label("user_role"),
            )
            .outerjoin(User, LeadImportBatch.user_id == User.id)
            .where(
                LeadImportBatch.id == batch_uuid,
                LeadImportBatch.organization_id == ctx.tenant_uuid,
            )
        )
        res = (await self.session.execute(stmt)).first()
        if not res:
            raise NotFoundError(f"Import batch '{batch_id}' was not found in this organization.")

        batch, u_name, u_email, u_role = res

        if ctx.is_salesperson and batch.user_id != ctx.user_uuid:
            raise ForbiddenError("Salespersons can only approve duplicates for their own import batches.")
        if ctx.is_manager:
            team_repo = TeamRepository(self.session)
            user_repo = UserRepository(self.session)
            mgr_team = await team_repo.get_active_manager_team(ctx.user_id, ctx.tenant_id)
            team_ids = {ctx.user_uuid}
            if mgr_team:
                team_users = await user_repo.list_by_team(mgr_team.id, ctx.tenant_id)
                team_ids.update(u.id for u in team_users)
            if batch.user_id not in team_ids:
                raise ForbiddenError("Managers can only approve duplicates for their own or team import batches.")

        if not allow_all and not row_numbers:
            raise BadRequestError("Select at least one duplicate row or set allow_all=true.")

        target_rows = set(row_numbers or [])
        now = datetime.now(timezone.utc)
        updated_log = copy.deepcopy(batch.error_log or [])
        to_insert: List[Lead] = []
        fallback_assignee = batch.user_id or ctx.user_uuid

        from backend.app.data.models.deal import Product

        # Resolve products for allowed duplicates
        raw_dup_prod_names = {
            (item.get("lead_data", {}).get("interested_product") or "").strip()
            for item in updated_log
            if item.get("lead_data", {}).get("interested_product")
        }
        dup_product_lookup: Dict[str, uuid.UUID] = {}
        if raw_dup_prod_names:
            dup_p_stmt = select(Product).where(
                Product.organization_id == ctx.tenant_uuid,
                Product.deleted_at.is_(None),
            )
            existing_p = (await self.session.execute(dup_p_stmt)).scalars().all()
            for p in existing_p:
                dup_product_lookup[p.name.lower().strip()] = p.id

            new_dup_prods = []
            for rname in raw_dup_prod_names:
                nkey = rname.lower().strip()
                if nkey not in dup_product_lookup:
                    sclean = re.sub(r'[^A-Z0-9]', '', rname.upper())[:6] or "PROD"
                    np = Product(
                        id=uuid.uuid4(),
                        organization_id=ctx.tenant_uuid,
                        name=rname,
                        sku=f"SKU-{sclean}-{uuid.uuid4().hex[:4].upper()}",
                        category="Imported",
                        price=0.0,
                        currency="USD",
                        is_active=True,
                    )
                    new_dup_prods.append(np)
                    dup_product_lookup[nkey] = np.id
            if new_dup_prods:
                self.session.add_all(new_dup_prods)
                await self.session.flush()

        for item in updated_log:
            is_dup = item.get("is_duplicate") or "duplicate" in (item.get("error") or "").lower()
            if not is_dup or item.get("allowed"):
                continue
            if not allow_all and item.get("row") not in target_rows:
                continue

            lead_data = item.get("lead_data")
            if not lead_data:
                continue

            pname = (lead_data.get("interested_product") or "").strip()
            matched_pid = dup_product_lookup.get(pname.lower().strip()) if pname else None

            to_insert.append(
                self._build_lead_from_data(
                    organization_id=ctx.tenant_uuid,
                    batch_id=batch.id,
                    data=lead_data,
                    now=now,
                    fallback_assignee=fallback_assignee,
                    product_id=matched_pid,
                )
            )
            item["allowed"] = True
            item["allowed_at"] = now.isoformat()

        if not to_insert:
            raise BadRequestError(
                "No pending duplicate leads with saved payload data matched your selection. Please re-import the CSV if this is an older batch."
            )

        chunk_size = 500
        for i in range(0, len(to_insert), chunk_size):
            chunk = to_insert[i : i + chunk_size]
            self.session.add_all(chunk)
            await self.session.flush()

        newly_inserted = len(to_insert)
        batch.inserted_count = (batch.inserted_count or 0) + newly_inserted
        batch.duplicate_count = max(0, (batch.duplicate_count or 0) - newly_inserted)
        batch.error_log = updated_log
        batch.updated_at = now

        await self.session.commit()

        return {
            "batch_id": str(batch.id),
            "file_name": batch.file_name,
            "total_rows": batch.total_rows,
            "inserted_count": batch.inserted_count,
            "duplicate_count": batch.duplicate_count,
            "error_count": batch.error_count,
            "newly_inserted": newly_inserted,
            "status": batch.status,
            "created_at": batch.created_at.isoformat() if batch.created_at else None,
            "user_id": str(batch.user_id) if batch.user_id else None,
            "user_name": u_name or (u_email.split("@")[0] if u_email else "System"),
            "user_role": u_role or "User",
            "error_sample": updated_log,
        }
