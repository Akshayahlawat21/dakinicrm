import io
import re
import csv
import uuid
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from backend.app.application.context import RequestContext
from backend.app.application.exceptions import BadRequestError
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

    async def import_leads_csv(
        self,
        ctx: RequestContext,
        file_content: bytes,
        file_name: str,
    ) -> Dict[str, Any]:
        """
        Executes end-to-end bulk lead import:
        1. Creates batch audit record (status: 'processing')
        2. Streams & parses CSV rows
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

        # 2. Decode content (supports utf-8-sig for Excel CSV BOM, utf-8, latin-1 fallback)
        try:
            text = file_content.decode("utf-8-sig")
        except UnicodeDecodeError:
            try:
                text = file_content.decode("utf-8")
            except UnicodeDecodeError:
                text = file_content.decode("latin-1")

        csv_reader = csv.reader(io.StringIO(text))
        rows = list(csv_reader)
        if not rows or len(rows) < 2:
            batch.status = "failed"
            batch.error_log = [{"row": 0, "error": "CSV file is empty or missing data rows."}]
            await self.session.commit()
            raise BadRequestError("Uploaded file is empty or missing header/data rows.")

        raw_headers = rows[0]
        mapped_headers = [_normalize_header(h) for h in raw_headers]
        data_rows = rows[1:]
        total_rows = len(data_rows)
        batch.total_rows = total_rows

        # 3. Stream & validate rows into candidates
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

            # Rule 4: Intra-file duplicate check
            norm_p = _norm_prod(product)
            if email and (email, norm_p) in seen_in_file_emails:
                in_file_duplicates += 1
                errors.append({"row": row_num, "name": name, "error": f"Duplicate entry within CSV file for email '{email}' and product '{product}'."})
                continue
            if phone and (phone, norm_p) in seen_in_file_phones:
                in_file_duplicates += 1
                errors.append({"row": row_num, "name": name, "error": f"Duplicate entry within CSV file for phone '{phone}' and product '{product}'."})
                continue

            if email:
                seen_in_file_emails.add((email, norm_p))
            if phone:
                seen_in_file_phones.add((phone, norm_p))

            valid_candidates.append({
                "row_num": row_num,
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
                    "error": f"Duplicate skipped: Active lead already exists for '{candidate['name']}' inquiring about '{candidate['interested_product'] or 'General'}'.",
                })
            else:
                new_lead = Lead(
                    id=uuid.uuid4(),
                    organization_id=ctx.tenant_uuid,
                    import_batch_id=batch_id,
                    name=candidate["name"],
                    company=candidate["company"],
                    email=candidate["email"],
                    phone=candidate["phone"],
                    industry=candidate["industry"],
                    title=candidate["title"],
                    website=candidate["website"],
                    source=candidate["source"],
                    score=candidate["score"],
                    status="New",
                    interested_product=candidate["interested_product"],
                    created_at=now,
                    updated_at=now,
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
        batch.error_log = errors[:100]  # store first 100 error details to avoid oversized JSON
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
            "error_sample": errors[:10],
        }
