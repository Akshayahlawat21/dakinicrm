from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

from app.config import get_settings

PERIODS = {"week", "month", "quarter", "year", "last_7_days", "last_30_days", "ytd"}
WON_DEFAULTS = {"won", "closed_won", "closed-won"}
LOST_DEFAULTS = {"lost", "closed_lost", "closed-lost", "cancelled", "canceled"}


def period_bounds(period: str, today: date | None = None) -> tuple[date, date]:
    """Return a half-open [start, end) date range for a supported report period."""
    today = today or datetime.now(timezone.utc).date()
    if period == "week":
        start = today - timedelta(days=today.weekday())
    elif period == "month":
        start = today.replace(day=1)
    elif period == "quarter":
        start = date(today.year, ((today.month - 1) // 3) * 3 + 1, 1)
    elif period in {"year", "ytd"}:
        start = date(today.year, 1, 1)
    elif period == "last_7_days":
        start = today - timedelta(days=6)
    elif period == "last_30_days":
        start = today - timedelta(days=29)
    else:
        raise ValueError("Unsupported period")
    return start, today + timedelta(days=1)


async def get_columns(conn: AsyncConnection, table: str) -> set[str]:
    result = await conn.execute(text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = :table
    """), {"table": table})
    return set(result.scalars().all())


async def table_exists(conn: AsyncConnection, table: str) -> bool:
    result = await conn.execute(text("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = :table
        )
    """), {"table": table})
    return bool(result.scalar_one())


def first_existing(columns: set[str], names: tuple[str, ...]) -> str | None:
    return next((name for name in names if name in columns), None)


def deal_status_expression(columns: set[str], alias: str = "t") -> str:
    """Build a safe status expression from column names verified against the schema."""
    if {"status", "stage"}.issubset(columns):
        return f"LOWER(COALESCE(NULLIF(BTRIM({alias}.status), ''), {alias}.stage, ''))"
    if "status" in columns:
        return f"LOWER(COALESCE({alias}.status, ''))"
    if "stage" in columns:
        return f"LOWER(COALESCE({alias}.stage, ''))"
    raise RuntimeError("Schema mismatch: deals needs status or stage")


def soft_delete_filter(columns: set[str], alias: str = "t") -> str:
    return f"AND {alias}.deleted_at IS NULL" if "deleted_at" in columns else ""


def _date_filter(columns: set[str], alias: str, choices: tuple[str, ...] = ("created_at",)) -> str:
    column = first_existing(columns, choices)
    if not column:
        raise RuntimeError(f"Schema mismatch: {alias} needs one of {choices}")
    return f"{alias}.{column} >= :start AND {alias}.{column} < :end"


def _won_values() -> list[str]:
    return list(dict.fromkeys([*get_settings().won_values, "won", "closed_won", "closed-won"]))


def _lost_values() -> list[str]:
    return list(dict.fromkeys([*get_settings().lost_values, "lost", "closed_lost", "closed-lost", "cancelled", "canceled"]))


def _deal_scope_filter(deal_cols: set[str], opp_cols: set[str], scoped_users: list | None, alias: str = "t") -> str:
    if not scoped_users:
        return ""
    if "owner_id" in deal_cols and "opportunity_id" in deal_cols:
        return f"AND ({alias}.owner_id = ANY(:scoped_users) OR {alias}.opportunity_id IN (SELECT id FROM public.opportunities WHERE owner_id = ANY(:scoped_users)))"
    if "owner_id" in deal_cols:
        return f"AND {alias}.owner_id = ANY(:scoped_users)"
    if "opportunity_id" in deal_cols:
        return f"AND {alias}.opportunity_id IN (SELECT id FROM public.opportunities WHERE owner_id = ANY(:scoped_users))"
    return ""


def _user_scope_filter(col_name: str, cols: set[str], scoped_users: list | None, alias: str = "t") -> str:
    if not scoped_users:
        return ""
    if col_name in cols:
        return f"AND {alias}.{col_name} = ANY(:scoped_users)"
    return ""


def _format_scoped_users(scoped_users: list | None) -> list | None:
    if not scoped_users:
        return None
    import uuid
    return [uuid.UUID(str(u)) if not isinstance(u, uuid.UUID) else u for u in scoped_users]


async def overview(conn: AsyncConnection, org: str, period: str, scoped_users: list | None = None) -> dict:
    start, end = period_bounds(period)
    leads_cols = await get_columns(conn, "leads")
    opp_cols = await get_columns(conn, "opportunities")
    deal_cols = await get_columns(conn, "deals")
    for table, columns, required in [
        ("leads", leads_cols, {"organization_id", "created_at"}),
        ("opportunities", opp_cols, {"organization_id", "stage", "amount"}),
        ("deals", deal_cols, {"organization_id", "amount"}),
    ]:
        if not required.issubset(columns):
            raise RuntimeError(f"Schema mismatch in {table}: missing {sorted(required - columns)}")

    formatted_users = _format_scoped_users(scoped_users)
    lead_scope = _user_scope_filter("assigned_to", leads_cols, formatted_users, "t")
    opp_scope = _user_scope_filter("owner_id", opp_cols, formatted_users, "t")
    deal_scope = _deal_scope_filter(deal_cols, opp_cols, formatted_users, "t")

    params_base = {"org": org, "start": start, "end": end}
    if formatted_users:
        params_base["scoped_users"] = formatted_users

    result = await conn.execute(text(f"""
        SELECT COUNT(*) FROM public.leads t
        WHERE t.organization_id = :org AND t.created_at >= :start AND t.created_at < :end
        {lead_scope}
        {soft_delete_filter(leads_cols)}
    """), params_base)
    total_leads = int(result.scalar_one())

    closed_stages = _won_values() + _lost_values() + ["closed"]
    opp_params = {"org": org, "closed_stages": [v.lower() for v in dict.fromkeys(closed_stages)]}
    if formatted_users:
        opp_params["scoped_users"] = formatted_users
    result = await conn.execute(text(f"""
        WITH pipeline_items AS (
            SELECT o.id, o.organization_id, 
                   COALESCE(d.owner_id, o.owner_id) AS owner_id, 
                   COALESCE(d.amount, o.amount) AS amount, 
                   LOWER(COALESCE(d.stage, o.stage, '')) AS stage,
                   (COALESCE(d.amount, o.amount) * CASE LOWER(COALESCE(d.stage, o.stage, ''))
                       WHEN 'negotiation' THEN 85
                       WHEN 'proposal' THEN 75
                       WHEN 'qualified' THEN 50
                       WHEN 'discovery' THEN 40
                       ELSE COALESCE(o.probability, 50)
                   END / 100.0) AS weighted_amount
            FROM public.opportunities o
            LEFT JOIN public.deals d ON d.opportunity_id = o.id AND d.organization_id = :org {soft_delete_filter(deal_cols, 'd')}
            WHERE o.organization_id = :org {soft_delete_filter(opp_cols, 'o')}
            UNION ALL
            SELECT d.id, d.organization_id, d.owner_id, d.amount, LOWER(COALESCE(d.stage, '')) AS stage,
                   (d.amount * CASE LOWER(COALESCE(d.stage, ''))
                       WHEN 'negotiation' THEN 85
                       WHEN 'proposal' THEN 75
                       WHEN 'qualified' THEN 50
                       WHEN 'discovery' THEN 40
                       ELSE 50
                   END / 100.0) AS weighted_amount
            FROM public.deals d
            WHERE d.organization_id = :org
              AND d.opportunity_id IS NULL
              {soft_delete_filter(deal_cols, 'd')}
              AND (d.status = 'open' OR d.status IS NULL)
              AND LOWER(COALESCE(d.stage, '')) NOT IN ('won', 'lost', 'closed won', 'closed_won', 'closed lost', 'closed_lost', 'closed')
        )
        SELECT COUNT(*) AS count, COALESCE(SUM(t.amount), 0) AS value,
               COALESCE(SUM(t.weighted_amount), 0) AS weighted_value
        FROM pipeline_items t
        WHERE t.organization_id = :org
          AND t.stage <> ALL(:closed_stages)
          {opp_scope}
    """), opp_params)
    pipeline = result.mappings().one()

    deal_date = first_existing(deal_cols, ("close_date", "closed_at", "created_at"))
    status_expr = deal_status_expression(deal_cols)
    if not deal_date:
        raise RuntimeError("Schema mismatch: deals needs close_date, closed_at or created_at")
    date_expr = f"COALESCE(t.{deal_date}, t.created_at)" if deal_date != "created_at" and "created_at" in deal_cols else f"t.{deal_date}"
    won_currency_expr = "t.currency" if "currency" in deal_cols else "'USD'"
    deal_params = {"org": org, "won_values": _won_values(), "start": start, "end": end}
    if formatted_users:
        deal_params["scoped_users"] = formatted_users
    result = await conn.execute(text(f"""
        SELECT COUNT(*) AS count, COALESCE(SUM(t.amount), 0) AS revenue, {won_currency_expr} AS currency
        FROM public.deals t
        WHERE t.organization_id = :org
          AND {status_expr} = ANY(:won_values)
          AND {date_expr} >= :start AND {date_expr} < :end
          {deal_scope}
          {soft_delete_filter(deal_cols)}
        GROUP BY {won_currency_expr}
    """), deal_params)
    won_rows = list(result.mappings())
    won_count = sum(int(row["count"]) for row in won_rows)
    won_by_currency = {str(row["currency"]): float(row["revenue"] or 0) for row in won_rows}
    won_revenue = (sum(won_by_currency.values()) if len(won_by_currency) <= 1 else None)

    conversion_available = False
    converted = 0
    conversion_rate = None
    if await table_exists(conn, "lead_conversions"):
        conversion_cols = await get_columns(conn, "lead_conversions")
        if {"lead_id", "conversion_date"}.issubset(conversion_cols) and "id" in leads_cols:
            conversion_available = True
            conversion_org_filter = "AND lc.organization_id = :org" if "organization_id" in conversion_cols else ""
            lead_deleted = "AND l.deleted_at IS NULL" if "deleted_at" in leads_cols else ""
            conv_lead_scope = _user_scope_filter("assigned_to", leads_cols, formatted_users, "l")
            result = await conn.execute(text(f"""
                SELECT COUNT(DISTINCT lc.lead_id)
                FROM public.lead_conversions lc
                JOIN public.leads l ON l.id = lc.lead_id
                WHERE l.organization_id = :org
                  AND l.created_at >= :start AND l.created_at < :end
                  AND lc.conversion_date >= :start AND lc.conversion_date < :end
                  {conv_lead_scope}
                  {conversion_org_filter} {lead_deleted}
            """), params_base)
            converted = int(result.scalar_one())
            conversion_rate = round(converted * 100 / total_leads, 2) if total_leads else 0.0

    activity_count = None
    if await table_exists(conn, "activities"):
        activity_cols = await get_columns(conn, "activities")
        activity_date = first_existing(activity_cols, ("start_at", "created_at", "occurred_at"))
        if "organization_id" in activity_cols and activity_date:
            act_scope = _user_scope_filter("user_id", activity_cols, formatted_users, "t")
            result = await conn.execute(text(f"""
                SELECT COUNT(*) FROM public.activities t
                WHERE t.organization_id = :org
                  AND COALESCE(t.{activity_date}, t.created_at) >= :start
                  AND COALESCE(t.{activity_date}, t.created_at) < :end
                  {act_scope}
            """ if activity_date == "start_at" and "created_at" in activity_cols else f"""
                SELECT COUNT(*) FROM public.activities t
                WHERE t.organization_id = :org
                  AND t.{activity_date} >= :start AND t.{activity_date} < :end
                  {act_scope}
            """), params_base)
            activity_count = int(result.scalar_one())

    return {
        "period": period,
        "start_date": start.isoformat(),
        "end_date": (end - timedelta(days=1)).isoformat(),
        "total_leads": total_leads,
        "converted_leads": converted,
        "conversion_metric_available": conversion_available,
        "lead_conversion_rate_percent": conversion_rate,
        "open_opportunities": int(pipeline["count"]),
        "open_pipeline_value": float(pipeline["value"] or 0),
        "weighted_pipeline_value": float(pipeline["weighted_value"] or 0),
        "deals_won": won_count,
        "closed_won_revenue": won_revenue if won_revenue is not None else (0.0 if not won_by_currency else None),
        "closed_won_currency": next(iter(won_by_currency)) if len(won_by_currency) == 1 else None,
        "closed_won_revenue_by_currency": won_by_currency,
        "activity_count": activity_count,
        "currency_note": "Amounts use stored currency units. Do not compare or sum across currencies without grouping by currency.",
    }


async def revenue_trend(conn: AsyncConnection, org: str, months: int, scoped_users: list | None = None) -> dict:
    if not 1 <= months <= 24:
        raise ValueError("months must be between 1 and 24")
    columns = await get_columns(conn, "deals")
    if not {"organization_id", "amount"}.issubset(columns):
        raise RuntimeError("Schema mismatch in deals: organization_id and amount are required")
    date_col = first_existing(columns, ("close_date", "closed_at", "created_at"))
    if not date_col:
        raise RuntimeError("Schema mismatch: deals needs close_date, closed_at or created_at")
    status_expr = deal_status_expression(columns)
    today = datetime.now(timezone.utc).date()
    first_month = date(today.year, today.month, 1)
    start = first_month
    for _ in range(months - 1):
        start = date(start.year - (1 if start.month == 1 else 0), 12 if start.month == 1 else start.month - 1, 1)
    end = date(today.year + (1 if today.month == 12 else 0), 1 if today.month == 12 else today.month + 1, 1)

    formatted_users = _format_scoped_users(scoped_users)
    opp_cols = await get_columns(conn, "opportunities") if await table_exists(conn, "opportunities") else set()
    deal_scope = _deal_scope_filter(columns, opp_cols, formatted_users, "t")
    deal_params = {"org": org, "won_values": _won_values(), "start": start, "end": end}
    if formatted_users:
        deal_params["scoped_users"] = formatted_users

    date_expr = f"COALESCE(t.{date_col}, t.created_at)" if date_col != "created_at" and "created_at" in columns else f"t.{date_col}"
    result = await conn.execute(text(f"""
        SELECT date_trunc('month', {date_expr})::date AS month,
               COALESCE(SUM(t.amount), 0) AS revenue, COUNT(*) AS deals_won,
               {('t.currency' if 'currency' in columns else "'USD'")} AS currency
        FROM public.deals t
        WHERE t.organization_id = :org AND {status_expr} = ANY(:won_values)
          AND {date_expr} >= :start AND {date_expr} < :end
          {deal_scope}
          {soft_delete_filter(columns)}
        GROUP BY 1, 4 ORDER BY 1
    """), deal_params)
    found = {}
    observed_currencies = set()
    for row in result.mappings():
        key = row["month"].isoformat()
        item = found.setdefault(key, {"revenue": 0.0, "deals_won": 0, "currencies": {}})
        currency_code = str(row.get("currency", "USD"))
        observed_currencies.add(currency_code)
        item["deals_won"] += int(row["deals_won"])
        item["currencies"][currency_code] = float(row["revenue"] or 0)
    mixed_actual_currencies = len(observed_currencies) > 1
    for item in found.values():
        item["revenue"] = sum(item["currencies"].values()) if not mixed_actual_currencies else None
    # Allocate configured sales-target amounts across overlapping months by calendar days.
    # This gives a target-pace line without inventing a target when no target records exist.
    target_allocations: dict[str, dict[str, float]] = {}
    target_table_available = await table_exists(conn, "sales_targets")
    if target_table_available:
        target_cols = await get_columns(conn, "sales_targets")
        if {"organization_id", "target_amount", "period_start", "period_end"}.issubset(target_cols):
            target_currency = "currency" if "currency" in target_cols else "'USD'"
            active_filter = "AND LOWER(COALESCE(status, 'active')) IN ('active','approved')" if "status" in target_cols else ""
            chosen_types = await _matching_target_types(
                conn, org, target_cols, start, end,
                [["monthly", "month"], ["quarterly", "quarter"], ["yearly", "annual", "year", "ytd"], ["weekly", "week"]],
            )
            if "period_type" in target_cols:
                target_type_filter = "AND LOWER(period_type) = ANY(:target_types)" if chosen_types else "AND 1 = 0"
            else:
                target_type_filter = ""
            target_scope = _user_scope_filter("assigned_to_user_id", target_cols, formatted_users, "public.sales_targets")
            target_params = {"org": org, "start": start, "end": end}
            if formatted_users:
                target_params["scoped_users"] = formatted_users
            if chosen_types and "period_type" in target_cols:
                target_params["target_types"] = chosen_types
            result = await conn.execute(text(f"""
                SELECT {target_currency} AS currency, target_amount, period_start, period_end
                FROM public.sales_targets
                WHERE organization_id = :org
                  AND period_start < :end AND period_end >= :start
                  {target_scope}
                  {active_filter} {target_type_filter}
            """), target_params)
            for target_row in result.mappings():
                target_start = target_row["period_start"]
                target_end = target_row["period_end"]
                target_end_exclusive = target_end + timedelta(days=1)
                duration = max(1, (target_end_exclusive - target_start).days)
                month_start = start
                for _ in range(months):
                    month_end = date(month_start.year + (1 if month_start.month == 12 else 0), 1 if month_start.month == 12 else month_start.month + 1, 1)
                    overlap_start = max(target_start, month_start)
                    overlap_end = min(target_end_exclusive, month_end)
                    overlap_days = max(0, (overlap_end - overlap_start).days)
                    if overlap_days:
                        month_key = month_start.isoformat()
                        currency_key = str(target_row["currency"])
                        currency_map = target_allocations.setdefault(month_key, {})
                        currency_map[currency_key] = currency_map.get(currency_key, 0.0) + float(target_row["target_amount"] or 0) * overlap_days / duration
                    month_start = month_end

    data, current = [], start
    for _ in range(months):
        key = current.isoformat()
        item = found.get(key, {"revenue": 0.0, "deals_won": 0, "currencies": {}})
        target_by_currency = target_allocations.get(key, {})
        item["target_currencies"] = {currency: round(value, 2) for currency, value in target_by_currency.items()}
        target_currency = next(iter(target_by_currency)) if len(target_by_currency) == 1 else None
        actual_currency = next(iter(item["currencies"])) if len(item["currencies"]) == 1 else None
        item["target"] = round(target_by_currency[target_currency], 2) if target_currency and (target_currency == actual_currency or (actual_currency is None and not item["currencies"])) else None
        data.append({"month": key, **item})
        current = date(current.year + (1 if current.month == 12 else 0), 1 if current.month == 12 else current.month + 1, 1)
    return {
        "months": months, "data": data, "currency_mixed": mixed_actual_currencies,
        "currency_note": "Revenue and targets are retained by currency. A combined top-level revenue value or target line is omitted when multiple currencies would otherwise be added together.",
    }


async def pipeline_by_stage(conn: AsyncConnection, org: str, scoped_users: list | None = None) -> dict:
    columns = await get_columns(conn, "opportunities")
    required = {"organization_id", "stage", "amount"}
    if not required.issubset(columns):
        raise RuntimeError(f"Schema mismatch in opportunities: missing {sorted(required - columns)}")
    deal_cols = await get_columns(conn, "deals")
    status_closed = _won_values() + _lost_values() + ["closed"]

    formatted_users = _format_scoped_users(scoped_users)
    opp_scope = _user_scope_filter("owner_id", columns, formatted_users, "t")
    params = {"org": org, "closed_stages": [v.lower() for v in dict.fromkeys(status_closed)]}
    if formatted_users:
        params["scoped_users"] = formatted_users

    result = await conn.execute(text(f"""
        WITH pipeline_items AS (
            SELECT o.id, o.organization_id, 
                   COALESCE(d.owner_id, o.owner_id) AS owner_id, 
                   COALESCE(d.amount, o.amount) AS amount, 
                   COALESCE(d.stage, o.stage, 'Unspecified') AS stage,
                   (COALESCE(d.amount, o.amount) * CASE LOWER(COALESCE(d.stage, o.stage, ''))
                       WHEN 'negotiation' THEN 85
                       WHEN 'proposal' THEN 75
                       WHEN 'qualified' THEN 50
                       WHEN 'discovery' THEN 40
                       ELSE COALESCE(o.probability, 50)
                   END / 100.0) AS weighted_amount
            FROM public.opportunities o
            LEFT JOIN public.deals d ON d.opportunity_id = o.id AND d.organization_id = :org {soft_delete_filter(deal_cols, 'd')}
            WHERE o.organization_id = :org {soft_delete_filter(columns, 'o')}
            UNION ALL
            SELECT d.id, d.organization_id, d.owner_id, d.amount, COALESCE(d.stage, 'Unspecified') AS stage,
                   (d.amount * CASE LOWER(COALESCE(d.stage, ''))
                       WHEN 'negotiation' THEN 85
                       WHEN 'proposal' THEN 75
                       WHEN 'qualified' THEN 50
                       WHEN 'discovery' THEN 40
                       ELSE 50
                   END / 100.0) AS weighted_amount
            FROM public.deals d
            WHERE d.organization_id = :org
              AND d.opportunity_id IS NULL
              {soft_delete_filter(deal_cols, 'd')}
              AND (d.status = 'open' OR d.status IS NULL)
              AND LOWER(COALESCE(d.stage, '')) NOT IN ('won', 'lost', 'closed won', 'closed_won', 'closed lost', 'closed_lost', 'closed')
        )
        SELECT t.stage AS stage,
               COUNT(*) AS opportunity_count, COALESCE(SUM(t.amount), 0) AS value,
               COALESCE(SUM(t.weighted_amount), 0) AS weighted_value
        FROM pipeline_items t
        WHERE t.organization_id = :org
          AND LOWER(t.stage) <> ALL(:closed_stages)
          {opp_scope}
        GROUP BY t.stage
        ORDER BY value DESC
    """), params)
    return {"data": [{
        "stage": row["stage"], "opportunity_count": int(row["opportunity_count"]),
        "value": float(row["value"] or 0), "weighted_value": float(row.get("weighted_value", 0) or 0)
    } for row in result.mappings()]}


async def lead_sources(conn: AsyncConnection, org: str, period: str, scoped_users: list | None = None) -> dict:
    start, end = period_bounds(period)
    columns = await get_columns(conn, "leads")
    required = {"organization_id", "source", "created_at"}
    if not required.issubset(columns):
        raise RuntimeError(f"Schema mismatch in leads: missing {sorted(required - columns)}")

    formatted_users = _format_scoped_users(scoped_users)
    lead_scope = _user_scope_filter("assigned_to", columns, formatted_users, "t")
    params = {"org": org, "start": start, "end": end}
    if formatted_users:
        params["scoped_users"] = formatted_users

    result = await conn.execute(text(f"""
        SELECT COALESCE(NULLIF(BTRIM(t.source), ''), 'Unknown') AS source, COUNT(*) AS lead_count
        FROM public.leads t
        WHERE t.organization_id = :org AND t.created_at >= :start AND t.created_at < :end
          {lead_scope}
          {soft_delete_filter(columns)}
        GROUP BY 1 ORDER BY lead_count DESC, source
    """), params)
    rows = [{"source": row["source"], "lead_count": int(row["lead_count"])} for row in result.mappings()]
    total = sum(row["lead_count"] for row in rows)
    return {"period": period, "total_leads": total, "data": rows}


async def conversion_funnel(conn: AsyncConnection, org: str, period: str, scoped_users: list | None = None) -> dict:
    """Event-based conversion funnel. MQL/SQL are counted only when CRM statuses explicitly match those labels."""
    start, end = period_bounds(period)
    lead_cols = await get_columns(conn, "leads")
    opp_cols = await get_columns(conn, "opportunities")
    deal_cols = await get_columns(conn, "deals")
    if not {"organization_id", "created_at"}.issubset(lead_cols):
        raise RuntimeError("Schema mismatch in leads: organization_id and created_at are required")
    lead_filter = soft_delete_filter(lead_cols)

    formatted_users = _format_scoped_users(scoped_users)
    lead_scope = _user_scope_filter("assigned_to", lead_cols, formatted_users, "t")
    conv_lead_scope = _user_scope_filter("assigned_to", lead_cols, formatted_users, "l")
    opp_scope = _user_scope_filter("owner_id", opp_cols, formatted_users, "t")
    deal_scope = _deal_scope_filter(deal_cols, opp_cols, formatted_users, "t")

    params_base = {"org": org, "start": start, "end": end}
    if formatted_users:
        params_base["scoped_users"] = formatted_users

    status_col = "status" if "status" in lead_cols else None
    if status_col:
        result = await conn.execute(text(f"""
            SELECT LOWER(BTRIM(COALESCE(status, ''))) AS status, COUNT(*) AS count
            FROM public.leads t
            WHERE t.organization_id = :org AND t.created_at >= :start AND t.created_at < :end
              {lead_scope}
              {lead_filter}
            GROUP BY 1
        """), params_base)
        statuses = {str(r["status"]): int(r["count"]) for r in result.mappings()}
    else:
        statuses = {}
    total_leads = sum(statuses.values()) if statuses else 0
    # MQL/SQL counts are status-derived, not fabricated. The API returns the status groups used.
    mql_keys = {"mql", "marketing qualified", "marketing_qualified", "marketing-qualified", "marketingqualified"}
    sql_keys = {"sql", "sales qualified", "sales_qualified", "sales-qualified", "salesqualified"}
    mql_matching_statuses = [status for status in statuses if status in mql_keys or ("marketing" in status and "qualif" in status)]
    sql_matching_statuses = [status for status in statuses if status in sql_keys or ("sales" in status and "qualif" in status)]
    mql = sum(statuses[status] for status in mql_matching_statuses)
    sql_count = sum(statuses[status] for status in sql_matching_statuses)
    mql_available = bool(mql_matching_statuses)
    sql_available = bool(sql_matching_statuses)
    conversion_available = await table_exists(conn, "lead_conversions")
    converted = 0
    if conversion_available:
        conv_cols = await get_columns(conn, "lead_conversions")
        if {"lead_id", "conversion_date"}.issubset(conv_cols) and "id" in lead_cols:
            conv_org = "AND lc.organization_id = :org" if "organization_id" in conv_cols else ""
            result = await conn.execute(text(f"""
                SELECT COUNT(DISTINCT lc.lead_id) FROM public.lead_conversions lc
                JOIN public.leads l ON l.id = lc.lead_id
                WHERE l.organization_id = :org
                  AND l.created_at >= :start AND l.created_at < :end
                  AND lc.conversion_date >= :start AND lc.conversion_date < :end
                  {conv_lead_scope}
                  {conv_org} {lead_filter.replace('t.', 'l.')}
            """), params_base)
            converted = int(result.scalar_one())
        else:
            conversion_available = False

    # Open opportunities are reported as current active pipeline, rather than pretending they are events.
    required_opp = {"organization_id", "stage"}
    if not required_opp.issubset(opp_cols):
        raise RuntimeError(f"Schema mismatch in opportunities: missing {sorted(required_opp - opp_cols)}")
    closed_stages = [v.lower() for v in dict.fromkeys(_won_values() + _lost_values() + ["closed"])]
    opp_params = {"org": org, "closed_stages": closed_stages}
    if formatted_users:
        opp_params["scoped_users"] = formatted_users
    result = await conn.execute(text(f"""
        WITH pipeline_items AS (
            SELECT o.id, o.organization_id, 
                   COALESCE(d.owner_id, o.owner_id) AS owner_id, 
                   LOWER(COALESCE(d.stage, o.stage, '')) AS stage
            FROM public.opportunities o
            LEFT JOIN public.deals d ON d.opportunity_id = o.id AND d.organization_id = :org {soft_delete_filter(deal_cols, 'd')}
            WHERE o.organization_id = :org {soft_delete_filter(opp_cols, 'o')}
            UNION ALL
            SELECT d.id, d.organization_id, d.owner_id, LOWER(COALESCE(d.stage, '')) AS stage
            FROM public.deals d
            WHERE d.organization_id = :org
              AND d.opportunity_id IS NULL
              {soft_delete_filter(deal_cols, 'd')}
              AND (d.status = 'open' OR d.status IS NULL)
              AND LOWER(COALESCE(d.stage, '')) NOT IN ('won', 'lost', 'closed won', 'closed_won', 'closed lost', 'closed_lost', 'closed')
        )
        SELECT COUNT(*) FROM pipeline_items t
        WHERE t.organization_id = :org AND t.stage <> ALL(:closed_stages)
          {opp_scope}
    """), opp_params)
    open_pipeline = int(result.scalar_one())

    won = 0
    deal_date = first_existing(deal_cols, ("close_date", "closed_at", "created_at"))
    if {"organization_id"}.issubset(deal_cols) and deal_date:
        status_expr = deal_status_expression(deal_cols)
        date_expr = f"COALESCE(t.{deal_date}, t.created_at)" if deal_date != "created_at" and "created_at" in deal_cols else f"t.{deal_date}"
        deal_params = {"org": org, "won_values": _won_values(), "start": start, "end": end}
        if formatted_users:
            deal_params["scoped_users"] = formatted_users
        result = await conn.execute(text(f"""
            SELECT COUNT(*) FROM public.deals t
            WHERE t.organization_id = :org AND {status_expr} = ANY(:won_values)
              AND {date_expr} >= :start AND {date_expr} < :end
              {deal_scope}
              {soft_delete_filter(deal_cols)}
        """), deal_params)
        won = int(result.scalar_one())
    raw = [
        ("Website inquiries / new leads", total_leads, True),
        ("Marketing qualified leads (MQL)", mql, mql_available),
        ("Sales qualified leads (SQL)", sql_count, sql_available),
        ("Converted leads", converted, conversion_available),
        ("Open opportunities (current)", open_pipeline, True),
        ("Closed-won deals", won, True),
    ]
    stages = []
    previous = None
    for name, count, available in raw:
        stages.append({
            "stage": name, "count": count,
            "conversion_from_previous_percent": None if previous in (None, 0) else round(count * 100 / previous, 2),
            "available": available,
        })
        previous = count
    return {
        "period": period, "start_date": start.isoformat(), "end_date": (end - timedelta(days=1)).isoformat(),
        "data": stages, "status_counts": statuses,
        "definitions": {
            "mql_sql": "Counted only when stored lead statuses explicitly identify marketing-qualified or sales-qualified. A stage is marked unavailable rather than zero when no matching status label exists in the selected cohort.",
            "converted": "Distinct leads with a lead_conversions event during the selected period.",
            "open_opportunities": "Current open opportunity inventory, not restricted by creation date.",
            "closed_won": "Deals whose selected close/created date is in the selected period and status/stage is configured as won.",
        },
    }


async def activity_performance(conn: AsyncConnection, org: str, period: str, scoped_users: list | None = None) -> dict:
    start, end = period_bounds(period)
    if not await table_exists(conn, "activities"):
        return {"period": period, "total_activities": 0, "completed_activities": 0, "by_type": [], "by_status": [], "by_owner": [], "data_status": "activities_table_missing"}
    cols = await get_columns(conn, "activities")
    if "organization_id" not in cols:
        raise RuntimeError("Schema mismatch in activities: organization_id is required")
    date_col = first_existing(cols, ("start_at", "created_at", "occurred_at"))
    if not date_col:
        raise RuntimeError("Schema mismatch in activities: expected start_at or created_at")
    date_expr = f"COALESCE(t.{date_col}, t.created_at)" if date_col == "start_at" and "created_at" in cols else f"t.{date_col}"
    deleted = soft_delete_filter(cols)

    formatted_users = _format_scoped_users(scoped_users)
    act_scope = _user_scope_filter("user_id", cols, formatted_users, "t")
    params = {"org": org, "start": start, "end": end}
    if formatted_users:
        params["scoped_users"] = formatted_users

    result = await conn.execute(text(f"""
        SELECT COUNT(*) AS total,
          COUNT(*) FILTER (WHERE LOWER(COALESCE(t.status, '')) IN ('completed','done')) AS completed
        FROM public.activities t
        WHERE t.organization_id = :org AND {date_expr} >= :start AND {date_expr} < :end
          {act_scope}
          {deleted}
    """), params)
    totals = result.mappings().one()
    group_type = "COALESCE(NULLIF(BTRIM(t.type), ''), 'Unknown')" if "type" in cols else "'Activity'"
    group_status = "COALESCE(NULLIF(BTRIM(t.status), ''), 'Unknown')" if "status" in cols else "'Unknown'"
    result = await conn.execute(text(f"""
        SELECT {group_type} AS label, COUNT(*) AS count
        FROM public.activities t WHERE t.organization_id = :org
          AND {date_expr} >= :start AND {date_expr} < :end {act_scope} {deleted}
        GROUP BY 1 ORDER BY count DESC, label
    """), params)
    by_type = [{"type": str(r["label"]), "count": int(r["count"])} for r in result.mappings()]
    result = await conn.execute(text(f"""
        SELECT {group_status} AS label, COUNT(*) AS count
        FROM public.activities t WHERE t.organization_id = :org
          AND {date_expr} >= :start AND {date_expr} < :end {act_scope} {deleted}
        GROUP BY 1 ORDER BY count DESC, label
    """), params)
    by_status = [{"status": str(r["label"]), "count": int(r["count"])} for r in result.mappings()]

    by_owner = []
    if "user_id" in cols and await table_exists(conn, "users"):
        users_cols = await get_columns(conn, "users")
        if {"id", "name"}.issubset(users_cols):
            user_deleted = "AND u.deleted_at IS NULL" if "deleted_at" in users_cols else ""
            result = await conn.execute(text(f"""
                SELECT u.id::text AS user_id, u.name AS name, COUNT(t.id) AS activity_count,
                  COUNT(t.id) FILTER (WHERE LOWER(COALESCE(t.status, '')) IN ('completed','done')) AS completed_count
                FROM public.activities t
                LEFT JOIN public.users u ON u.id = t.user_id AND u.organization_id = :org {user_deleted}
                WHERE t.organization_id = :org AND {date_expr} >= :start AND {date_expr} < :end {act_scope} {deleted}
                GROUP BY u.id, u.name ORDER BY activity_count DESC, name NULLS LAST
            """), params)
            by_owner = [{"user_id": r["user_id"], "name": r["name"] or "Unassigned", "activity_count": int(r["activity_count"]), "completed_count": int(r["completed_count"])} for r in result.mappings()]
    return {
        "period": period, "start_date": start.isoformat(), "end_date": (end - timedelta(days=1)).isoformat(),
        "total_activities": int(totals["total"]), "completed_activities": int(totals["completed"]),
        "completion_rate_percent": round(int(totals["completed"]) * 100 / int(totals["total"]), 2) if int(totals["total"]) else 0.0,
        "by_type": by_type, "by_status": by_status, "by_owner": by_owner,
    }


def _target_type_aliases(period: str) -> list[str]:
    if period in {"week", "last_7_days"}:
        return ["weekly", "week"]
    if period in {"month", "last_30_days"}:
        return ["monthly", "month"]
    if period == "quarter":
        return ["quarterly", "quarter"]
    return ["yearly", "annual", "year", "ytd"]


async def _matching_target_types(
    conn: AsyncConnection,
    org: str,
    columns: set[str],
    start: date,
    end_exclusive: date,
    preference_groups: list[list[str]],
) -> list[str] | None:
    """Choose one target cadence to avoid summing weekly, monthly, quarterly and yearly quotas together."""
    if "period_type" not in columns:
        return None
    active = "AND LOWER(COALESCE(status, 'active')) IN ('active','approved')" if "status" in columns else ""
    result = await conn.execute(text(f"""
        SELECT DISTINCT LOWER(BTRIM(period_type)) AS period_type
        FROM public.sales_targets
        WHERE organization_id = :org AND period_start < :end
          AND period_end >= :start {active}
    """), {"org": org, "start": start, "end": end_exclusive})
    available = {str(row["period_type"]) for row in result.mappings() if row["period_type"]}
    for group in preference_groups:
        matched = [value for value in group if value in available]
        if matched:
            return matched
    return None


async def quota_leaderboard(conn: AsyncConnection, org: str, period: str, scoped_users: list | None = None) -> dict:
    start, end = period_bounds(period)
    if not await table_exists(conn, "sales_targets") or not await table_exists(conn, "users"):
        return {"period": period, "data": [], "data_status": "targets_or_users_table_missing"}
    target_cols = await get_columns(conn, "sales_targets")
    users_cols = await get_columns(conn, "users")
    required = {"organization_id", "assigned_to_user_id", "target_amount", "period_start", "period_end"}
    if not required.issubset(target_cols) or not {"id", "name", "organization_id"}.issubset(users_cols):
        raise RuntimeError("Schema mismatch in sales_targets/users needed for quota leaderboard")
    target_currency = "st.currency" if "currency" in target_cols else "'USD'"
    target_active = "AND LOWER(COALESCE(st.status, 'active')) IN ('active','approved')" if "status" in target_cols else ""
    target_deleted = "AND u.deleted_at IS NULL" if "deleted_at" in users_cols else ""
    target_type_groups = {
        "week": [["weekly", "week"], ["monthly", "month"], ["quarterly", "quarter"], ["yearly", "annual", "year", "ytd"]],
        "last_7_days": [["weekly", "week"], ["monthly", "month"], ["quarterly", "quarter"], ["yearly", "annual", "year", "ytd"]],
        "month": [["monthly", "month"], ["quarterly", "quarter"], ["yearly", "annual", "year", "ytd"], ["weekly", "week"]],
        "last_30_days": [["monthly", "month"], ["quarterly", "quarter"], ["yearly", "annual", "year", "ytd"], ["weekly", "week"]],
        "quarter": [["quarterly", "quarter"], ["yearly", "annual", "year", "ytd"], ["monthly", "month"], ["weekly", "week"]],
        "year": [["yearly", "annual", "year", "ytd"], ["quarterly", "quarter"], ["monthly", "month"], ["weekly", "week"]],
        "ytd": [["yearly", "annual", "year", "ytd"], ["quarterly", "quarter"], ["monthly", "month"], ["weekly", "week"]],
    }
    chosen_types = await _matching_target_types(conn, org, target_cols, start, end, target_type_groups[period])
    if "period_type" in target_cols:
        target_type_filter = "AND LOWER(st.period_type) = ANY(:target_types)" if chosen_types else "AND 1 = 0"
    else:
        target_type_filter = ""

    formatted_users = _format_scoped_users(scoped_users)
    target_scope = _user_scope_filter("assigned_to_user_id", target_cols, formatted_users, "st")
    target_params = {"org": org, "start": start, "last_day": end - timedelta(days=1)}
    if formatted_users:
        target_params["scoped_users"] = formatted_users
    if chosen_types and "period_type" in target_cols:
        target_params["target_types"] = chosen_types

    result = await conn.execute(text(f"""
        SELECT u.id::text AS user_id, u.name, {target_currency} AS currency,
               COALESCE(SUM(
                 st.target_amount *
                 GREATEST(0, LEAST(st.period_end, :last_day) - GREATEST(st.period_start, :start) + 1)::numeric
                 / GREATEST(1, st.period_end - st.period_start + 1)
               ),0) AS target_amount,
               MIN(st.period_start) AS target_period_start, MAX(st.period_end) AS target_period_end,
               COUNT(st.id) AS target_count
        FROM public.sales_targets st
        JOIN public.users u ON u.id = st.assigned_to_user_id AND u.organization_id = :org
        WHERE st.organization_id = :org
          AND st.period_start <= :last_day AND st.period_end >= :start
          {target_scope}
          {target_active} {target_deleted} {target_type_filter}
        GROUP BY u.id, u.name, {target_currency}
        ORDER BY u.name
    """), target_params)
    rows = [dict(r) for r in result.mappings()]
    if not rows:
        return {"period": period, "start_date": start.isoformat(), "end_date": (end - timedelta(days=1)).isoformat(), "data": [], "data_status": "no_matching_targets"}
    deal_cols = await get_columns(conn, "deals") if await table_exists(conn, "deals") else set()
    opp_cols = await get_columns(conn, "opportunities") if await table_exists(conn, "opportunities") else set()
    won_by_key = {}
    pipeline_by_key = {}
    if deal_cols and {"organization_id", "amount"}.issubset(deal_cols):
        d_date = first_existing(deal_cols, ("close_date", "closed_at", "created_at"))
        currency_expr = "d.currency" if "currency" in deal_cols else "'USD'"
        status_expr = deal_status_expression(deal_cols, "d")
        if d_date:
            d_deleted = soft_delete_filter(deal_cols, "d")
            o_deleted = soft_delete_filter(opp_cols, "o") if opp_cols else ""
            deal_params = {"org": org, "start": start, "end": end, "won_values": _won_values()}
            deal_scope = f"AND COALESCE(d.owner_id, o.owner_id) = ANY(:scoped_users)" if formatted_users else ""
            if formatted_users:
                deal_params["scoped_users"] = formatted_users
            result = await conn.execute(text(f"""
                SELECT COALESCE(d.owner_id, o.owner_id)::text AS user_id, {currency_expr} AS currency,
                       COALESCE(SUM(d.amount),0) AS won_revenue, COUNT(*) AS deals_won
                FROM public.deals d LEFT JOIN public.opportunities o ON o.id = d.opportunity_id
                WHERE d.organization_id = :org AND COALESCE(d.owner_id, o.owner_id) IS NOT NULL
                  AND {status_expr} = ANY(:won_values) AND d.{d_date} >= :start AND d.{d_date} < :end
                  {deal_scope}
                  {d_deleted} {o_deleted}
                GROUP BY COALESCE(d.owner_id, o.owner_id), {currency_expr}
            """), deal_params)
            for r in result.mappings():
                won_by_key[(r["user_id"], str(r["currency"]))] = (float(r["won_revenue"] or 0), int(r["deals_won"]))
    if (opp_cols and {"organization_id", "owner_id", "amount", "stage"}.issubset(opp_cols)) or (deal_cols and {"organization_id", "owner_id", "amount", "stage"}.issubset(deal_cols)):
        closed = [v.lower() for v in dict.fromkeys(_won_values() + _lost_values() + ["closed"])]
        opp_params = {"org": org, "closed": closed}
        opp_scope = f"AND t.owner_id = ANY(:scoped_users)" if formatted_users else ""
        if formatted_users:
            opp_params["scoped_users"] = formatted_users
        result = await conn.execute(text(f"""
            WITH pipeline_items AS (
                SELECT o.id, o.organization_id, o.owner_id, o.amount, LOWER(COALESCE(o.stage, '')) AS stage
                FROM public.opportunities o
                WHERE o.organization_id = :org {soft_delete_filter(opp_cols, 'o')}
                UNION ALL
                SELECT d.id, d.organization_id, d.owner_id, d.amount, LOWER(COALESCE(d.stage, '')) AS stage
                FROM public.deals d
                WHERE d.organization_id = :org
                  AND (d.opportunity_id IS NULL OR d.opportunity_id NOT IN (SELECT sub_o.id FROM public.opportunities sub_o WHERE sub_o.organization_id = :org {soft_delete_filter(opp_cols, 'sub_o')}))
                  {soft_delete_filter(deal_cols, 'd')}
                  AND (d.status = 'open' OR d.status IS NULL)
                  AND LOWER(COALESCE(d.stage, '')) NOT IN ('won', 'lost', 'closed won', 'closed_won', 'closed lost', 'closed_lost', 'closed')
            )
            SELECT t.owner_id::text AS user_id, COALESCE(SUM(t.amount),0) AS pipeline_value
            FROM pipeline_items t WHERE t.organization_id = :org AND t.owner_id IS NOT NULL
              AND t.stage <> ALL(:closed)
              {opp_scope}
            GROUP BY t.owner_id
        """), opp_params)
        for r in result.mappings():
            pipeline_by_key[r["user_id"]] = float(r["pipeline_value"] or 0)

    data = []
    for row in rows:
        user_id = row["user_id"]
        currency = str(row["currency"])
        target_amount = float(row["target_amount"] or 0)
        won_revenue, deals_won = won_by_key.get((user_id, currency), (0.0, 0))
        data.append({
            "user_id": user_id, "name": row["name"], "currency": currency,
            "target_amount": target_amount, "won_revenue": won_revenue,
            "deals_won": deals_won, "open_pipeline_value": pipeline_by_key.get(user_id, 0.0),
            "attainment_percent": round(won_revenue * 100 / target_amount, 2) if target_amount else None,
            "target_period_start": row["target_period_start"].isoformat() if row["target_period_start"] else None,
            "target_period_end": row["target_period_end"].isoformat() if row["target_period_end"] else None,
            "target_records": int(row["target_count"]),
        })
    data.sort(key=lambda x: (x["attainment_percent"] is None, -(x["attainment_percent"] or 0), x["name"]))
    return {
        "period": period, "start_date": start.isoformat(), "end_date": (end - timedelta(days=1)).isoformat(),
        "data": data,
        "note": "Quota attainment compares won revenue in the selected report period with targets whose target dates overlap that period. Inspect target_period_start/end when target periods are longer than the selected window.",
    }


async def target_pace(conn: AsyncConnection, org: str, period: str, scoped_users: list | None = None) -> dict:
    start, end = period_bounds(period)
    today = datetime.now(timezone.utc).date()
    targets_exist = await table_exists(conn, "sales_targets")
    if not targets_exist:
        return {"period": period, "target_available": False, "target_amount": None, "actual_revenue": 0.0, "attainment_percent": None, "expected_pace_percent": None, "data_status": "sales_targets_table_missing"}
    cols = await get_columns(conn, "sales_targets")
    required = {"organization_id", "target_amount", "period_start", "period_end"}
    if not required.issubset(cols):
        raise RuntimeError("Schema mismatch in sales_targets needed for target pace")
    currency = "currency" if "currency" in cols else None
    currency_expr = f"currency" if currency else "'USD'"
    active = "AND LOWER(COALESCE(status, 'active')) IN ('active','approved')" if "status" in cols else ""
    target_type_groups = {
        "week": [["weekly", "week"], ["monthly", "month"], ["quarterly", "quarter"], ["yearly", "annual", "year", "ytd"]],
        "last_7_days": [["weekly", "week"], ["monthly", "month"], ["quarterly", "quarter"], ["yearly", "annual", "year", "ytd"]],
        "month": [["monthly", "month"], ["quarterly", "quarter"], ["yearly", "annual", "year", "ytd"], ["weekly", "week"]],
        "last_30_days": [["monthly", "month"], ["quarterly", "quarter"], ["yearly", "annual", "year", "ytd"], ["weekly", "week"]],
        "quarter": [["quarterly", "quarter"], ["yearly", "annual", "year", "ytd"], ["monthly", "month"], ["weekly", "week"]],
        "year": [["yearly", "annual", "year", "ytd"], ["quarterly", "quarter"], ["monthly", "month"], ["weekly", "week"]],
        "ytd": [["yearly", "annual", "year", "ytd"], ["quarterly", "quarter"], ["monthly", "month"], ["weekly", "week"]],
    }
    chosen_types = await _matching_target_types(conn, org, cols, start, end, target_type_groups[period])
    if "period_type" in cols:
        target_type_filter = "AND LOWER(period_type) = ANY(:target_types)" if chosen_types else "AND 1 = 0"
    else:
        target_type_filter = ""

    formatted_users = _format_scoped_users(scoped_users)
    target_scope = _user_scope_filter("assigned_to_user_id", cols, formatted_users, "public.sales_targets")
    target_params = {"org": org, "start": start, "last_day": end - timedelta(days=1)}
    if formatted_users:
        target_params["scoped_users"] = formatted_users
    if chosen_types and "period_type" in cols:
        target_params["target_types"] = chosen_types

    result = await conn.execute(text(f"""
        SELECT {currency_expr} AS currency,
               COALESCE(SUM(
                 target_amount *
                 GREATEST(0, LEAST(period_end, :last_day) - GREATEST(period_start, :start) + 1)::numeric
                 / GREATEST(1, period_end - period_start + 1)
               ),0) AS target_amount,
               MIN(period_start) AS period_start, MAX(period_end) AS period_end
        FROM public.sales_targets
        WHERE organization_id = :org AND period_start <= :last_day AND period_end >= :start
          {target_scope}
          {active} {target_type_filter}
        GROUP BY {currency_expr}
    """), target_params)
    target_rows = list(result.mappings())
    deal_cols = await get_columns(conn, "deals") if await table_exists(conn, "deals") else set()
    actual_by_currency = {}
    if {"organization_id", "amount"}.issubset(deal_cols):
        date_col = first_existing(deal_cols, ("close_date", "closed_at", "created_at"))
        if date_col:
            status = deal_status_expression(deal_cols)
            c = "currency" if "currency" in deal_cols else None
            c_expr = c if c else "'USD'"
            opp_cols = await get_columns(conn, "opportunities") if await table_exists(conn, "opportunities") else set()
            deal_scope = _deal_scope_filter(deal_cols, opp_cols, formatted_users, "t")
            deal_params = {"org": org, "start": start, "end": end, "won_values": _won_values()}
            if formatted_users:
                deal_params["scoped_users"] = formatted_users
            result = await conn.execute(text(f"""
                SELECT {c_expr} AS currency, COALESCE(SUM(amount),0) AS revenue
                FROM public.deals t WHERE organization_id = :org
                  AND {status} = ANY(:won_values) AND t.{date_col} >= :start AND t.{date_col} < :end
                  {deal_scope}
                  {soft_delete_filter(deal_cols)}
                GROUP BY {c_expr}
            """), deal_params)
            actual_by_currency = {str(r["currency"]): float(r["revenue"] or 0) for r in result.mappings()}
    days_total = max(1, (end - start).days)
    days_elapsed = max(0, min(days_total, (min(today + timedelta(days=1), end) - start).days))
    elapsed_pct = round(days_elapsed * 100 / days_total, 2)
    data = []
    for row in target_rows:
        curr = str(row["currency"])
        target = float(row["target_amount"] or 0)
        actual = actual_by_currency.get(curr, 0.0)
        data.append({
            "currency": curr, "target_amount": target, "actual_revenue": actual,
            "attainment_percent": round(actual * 100 / target, 2) if target else None,
            "expected_pace_percent": elapsed_pct,
            "expected_revenue_to_date": round(target * elapsed_pct / 100, 2),
            "ahead_or_behind": round(actual - target * elapsed_pct / 100, 2),
            "target_period_start": row["period_start"].isoformat() if row["period_start"] else None,
            "target_period_end": row["period_end"].isoformat() if row["period_end"] else None,
        })
    return {
        "period": period, "start_date": start.isoformat(), "end_date": (end - timedelta(days=1)).isoformat(),
        "target_available": bool(data), "data": data,
        "data_status": "available" if data else "no_matching_targets",
        "note": "Target pace is linear by calendar-day elapsed percentage. Target records overlapping the selected range are included; validate target-period policy with the business owner.",
    }
