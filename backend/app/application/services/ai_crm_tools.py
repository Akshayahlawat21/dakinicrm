"""Read-only, role-scoped CRM data tools for the AI copilot.

The LLM may choose filters, but it never receives database credentials or SQL
execution capability. Every query is scoped here using the authenticated
RequestContext before user-supplied filters are applied.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.application.context import RequestContext
from backend.app.data.models.account import Account
from backend.app.data.models.contact import Contact
from backend.app.data.models.activity import Activity
from backend.app.data.models.campaign import Campaign
from backend.app.data.models.deal import Deal, DealProduct, Opportunity, Product
from backend.app.data.models.lead import Lead, LeadConversion
from backend.app.data.models.organization import Team, TeamMember
from backend.app.data.models.user import User

MAX_TOOL_ROWS = 50


def _safe_text(value: Any, *, max_length: int = 120) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in {"all", "any", "none", "null"}:
        return None
    return text[:max_length]


def _parse_date(value: Any, *, end_of_day: bool = False) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, date):
        parsed = datetime.combine(value, time.max if end_of_day else time.min)
    else:
        raw = str(value).strip()
        try:
            if len(raw) == 10:
                parsed_date = date.fromisoformat(raw)
                parsed = datetime.combine(parsed_date, time.max if end_of_day else time.min)
            else:
                parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError("Dates must be ISO format, for example 2026-11-01") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _date_bounds(args: dict[str, Any]) -> tuple[datetime | None, datetime | None]:
    now = datetime.now(timezone.utc)
    range_name = (_safe_text(args.get("date_range"), max_length=32) or "").lower().replace("-", "_").replace(" ", "_")
    start: datetime | None = None
    end: datetime | None = None
    if range_name in {"last_7_days", "past_7_days", "week"}:
        start = now - timedelta(days=7)
    elif range_name in {"last_30_days", "past_30_days", "month"}:
        start = now - timedelta(days=30)
    elif range_name in {"last_90_days", "past_90_days", "quarter"}:
        start = now - timedelta(days=90)
    elif range_name in {"this_month", "current_month"}:
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif range_name in {"this_quarter", "current_quarter"}:
        quarter_month = ((now.month - 1) // 3) * 3 + 1
        start = now.replace(month=quarter_month, day=1, hour=0, minute=0, second=0, microsecond=0)
    elif range_name in {"this_year", "year_to_date", "ytd"}:
        start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    elif range_name in {"today"}:
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif range_name in {"yesterday"}:
        end = now.replace(hour=0, minute=0, second=0, microsecond=0)
        start = end - timedelta(days=1)
    elif range_name in {"this_week", "current_week"}:
        start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    elif range_name in {"last_week", "previous_week"}:
        end = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        start = end - timedelta(days=7)
    elif range_name in {"all_time", "all", ""}:
        pass
    else:
        raise ValueError("Unsupported date_range. Use last_7_days, last_30_days, last_90_days, this_month, this_quarter, this_year, or all_time.")

    explicit_start = _parse_date(args.get("created_after"))
    explicit_end = _parse_date(args.get("created_before"), end_of_day=True)
    if explicit_start and start and explicit_start > start:
        start = explicit_start
    elif explicit_start:
        start = explicit_start
    if explicit_end:
        end = explicit_end
    if start and end and start > end:
        raise ValueError("created_after must be earlier than or equal to created_before")
    return start, end


def _apply_created_at(stmt, column, bounds: tuple[datetime | None, datetime | None]):
    start, end = bounds
    if start:
        stmt = stmt.where(column >= start)
    if end:
        stmt = stmt.where(column <= end)
    return stmt


async def _visible_user_ids(session: AsyncSession, ctx: RequestContext) -> list[uuid.UUID] | None:
    """None means tenant-wide (owner); [] means no visible records."""
    if ctx.is_owner:
        return None
    if not ctx.is_manager:
        return [ctx.user_uuid]

    team_stmt = select(Team.id).where(
        Team.organization_id == ctx.tenant_uuid,
        Team.manager_id == ctx.user_uuid,
        Team.status == "active",
        Team.deleted_at.is_(None),
    )
    # Managers can be responsible for more than one active team.
    team_ids = list((await session.execute(team_stmt)).scalars().all())
    if not team_ids:
        # A manager still has access to their own assigned records without a team.
        return [ctx.user_uuid]
    member_stmt = select(TeamMember.user_id).join(
        User, User.id == TeamMember.user_id
    ).where(
        TeamMember.team_id.in_(team_ids),
        TeamMember.is_active.is_(True),
        User.organization_id == ctx.tenant_uuid,
        User.status == "active",
        User.deleted_at.is_(None),
    )
    member_ids = list((await session.execute(member_stmt)).scalars().all())
    # Existing CRM list services include the manager as well as active team members.
    return list(dict.fromkeys([ctx.user_uuid, *member_ids]))


def _lead_scope(visible_ids: list[uuid.UUID] | None):
    if visible_ids is None:
        return []
    if not visible_ids:
        return [Lead.id.is_(None)]
    # Unassigned leads are deliberately excluded for non-owner roles.
    return [Lead.assigned_to.in_(visible_ids)]


def _deal_scope(visible_ids: list[uuid.UUID] | None):
    if visible_ids is None:
        return []
    if not visible_ids:
        return [Deal.id.is_(None)]
    owned_opportunities = select(Opportunity.id).where(
        Opportunity.organization_id == Deal.organization_id,
        Opportunity.deleted_at.is_(None),
        Opportunity.owner_id.in_(visible_ids),
    )
    return [or_(Deal.owner_id.in_(visible_ids), Deal.opportunity_id.in_(owned_opportunities))]


def _limit(args: dict[str, Any]) -> int:
    try:
        return min(MAX_TOOL_ROWS, max(1, int(args.get("limit", 20))))
    except (TypeError, ValueError):
        return 20


def _campaign_filter_ids(campaign_text: str | None, tenant_id: uuid.UUID):
    if not campaign_text:
        return None
    try:
        campaign_uuid = uuid.UUID(campaign_text)
        return select(Campaign.id).where(Campaign.id == campaign_uuid, Campaign.organization_id == tenant_id, Campaign.deleted_at.is_(None))
    except ValueError:
        return select(Campaign.id).where(Campaign.organization_id == tenant_id, Campaign.deleted_at.is_(None), func.lower(Campaign.name).like(f"%{campaign_text.lower()}%"))


def _product_filter_ids(product_text: str | None, tenant_id: uuid.UUID):
    if not product_text:
        return None
    try:
        product_uuid = uuid.UUID(product_text)
        return select(Product.id).where(Product.id == product_uuid, Product.organization_id == tenant_id, Product.deleted_at.is_(None))
    except ValueError:
        return select(Product.id).where(Product.organization_id == tenant_id, Product.deleted_at.is_(None), func.lower(Product.name).like(f"%{product_text.lower()}%"))


def _user_filter_ids(user_text: str | None, tenant_id: uuid.UUID):
    if not user_text:
        return None
    try:
        user_uuid = uuid.UUID(user_text)
        return select(User.id).where(User.id == user_uuid, User.organization_id == tenant_id, User.deleted_at.is_(None))
    except ValueError:
        return select(User.id).where(User.organization_id == tenant_id, User.deleted_at.is_(None), User.name.ilike(f"%{user_text}%"))


def _apply_lead_filters(stmt, args: dict[str, Any], bounds, visible_ids, tenant_id: uuid.UUID):
    stmt = stmt.where(Lead.organization_id == tenant_id, Lead.deleted_at.is_(None), *_lead_scope(visible_ids))
    status = _safe_text(args.get("status"), max_length=30)
    source = _safe_text(args.get("source"), max_length=50)
    campaign = _campaign_filter_ids(_safe_text(args.get("campaign")), tenant_id)
    product = _product_filter_ids(_safe_text(args.get("product")), tenant_id)
    assigned_to = _user_filter_ids(_safe_text(args.get("assigned_to")), tenant_id)
    search = _safe_text(args.get("search"), max_length=100)
    if status:
        stmt = stmt.where(func.lower(Lead.status) == status.lower())
    if source:
        stmt = stmt.where(func.lower(Lead.source) == source.lower())
    if campaign is not None:
        stmt = stmt.where(Lead.campaign_id.in_(campaign))
    if product is not None:
        stmt = stmt.where(Lead.product_id.in_(product))
    if assigned_to is not None:
        stmt = stmt.where(Lead.assigned_to.in_(assigned_to))
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(or_(Lead.name.ilike(pattern), Lead.company.ilike(pattern), Lead.source.ilike(pattern)))
    try:
        min_score = args.get("min_score")
        max_score = args.get("max_score")
        if min_score is not None:
            stmt = stmt.where(Lead.score >= int(min_score))
        if max_score is not None:
            stmt = stmt.where(Lead.score <= int(max_score))
    except (TypeError, ValueError) as exc:
        raise ValueError("min_score and max_score must be integers") from exc
    return _apply_created_at(stmt, Lead.created_at, bounds)


def _apply_deal_filters(stmt, args: dict[str, Any], bounds, visible_ids, tenant_id: uuid.UUID):
    stmt = stmt.where(Deal.organization_id == tenant_id, Deal.deleted_at.is_(None), *_deal_scope(visible_ids))
    stage = _safe_text(args.get("stage"), max_length=50)
    status = _safe_text(args.get("status"), max_length=20)
    currency = _safe_text(args.get("currency"), max_length=3)
    account = _safe_text(args.get("account"), max_length=100)
    search = _safe_text(args.get("search"), max_length=100)
    campaign = _campaign_filter_ids(_safe_text(args.get("campaign")), tenant_id)
    product = _product_filter_ids(_safe_text(args.get("product")), tenant_id)
    owner = _user_filter_ids(_safe_text(args.get("owner")), tenant_id)
    if stage:
        stmt = stmt.where(func.lower(Deal.stage) == stage.lower())
    if status:
        stmt = stmt.where(func.lower(Deal.status) == status.lower())
    if currency:
        stmt = stmt.where(func.upper(Deal.currency) == currency.upper())
    if account:
        stmt = stmt.where(func.lower(Account.name).like(f"%{account.lower()}%"))
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(or_(Deal.name.ilike(pattern), Account.name.ilike(pattern)))
    if campaign is not None:
        campaign_leads = select(LeadConversion.opportunity_id).join(
            Lead, Lead.id == LeadConversion.lead_id
        ).where(
            Lead.organization_id == Deal.organization_id,
            Lead.deleted_at.is_(None),
            Lead.campaign_id.in_(campaign),
            *_lead_scope(visible_ids),
        )
        stmt = stmt.where(Deal.opportunity_id.in_(campaign_leads))
    if product is not None:
        deal_products = select(DealProduct.deal_id).where(DealProduct.product_id.in_(product))
        stmt = stmt.where(Deal.id.in_(deal_products))
    if owner is not None:
        owned_opportunities = select(Opportunity.id).where(
            Opportunity.organization_id == tenant_id,
            Opportunity.deleted_at.is_(None),
            Opportunity.owner_id.in_(owner),
        )
        stmt = stmt.where(or_(Deal.owner_id.in_(owner), Deal.opportunity_id.in_(owned_opportunities)))
    try:
        min_amount = args.get("min_amount")
        max_amount = args.get("max_amount")
        if min_amount is not None:
            stmt = stmt.where(Deal.amount >= float(min_amount))
        if max_amount is not None:
            stmt = stmt.where(Deal.amount <= float(max_amount))
    except (TypeError, ValueError) as exc:
        raise ValueError("min_amount and max_amount must be numbers") from exc
    return _apply_created_at(stmt, Deal.created_at, bounds)


async def search_leads(session: AsyncSession, ctx: RequestContext, args: dict[str, Any]) -> dict[str, Any]:
    bounds = _date_bounds(args)
    visible_ids = await _visible_user_ids(session, ctx)
    base = select(Lead).where(
        Lead.organization_id == ctx.tenant_uuid,
        *_lead_scope(visible_ids),
    )
    base = _apply_lead_filters(base, args, bounds, visible_ids, ctx.tenant_uuid)
    count_stmt = select(func.count()).select_from(base.order_by(None).subquery())
    total = int((await session.execute(count_stmt)).scalar_one())
    filtered_ids = base.with_only_columns(Lead.id).order_by(None).subquery()
    rows_stmt = select(
        Lead, Campaign.name.label("campaign_name"), Product.name.label("product_name")
    ).outerjoin(
        Campaign,
        and_(Campaign.id == Lead.campaign_id, Campaign.organization_id == ctx.tenant_uuid, Campaign.deleted_at.is_(None)),
    ).outerjoin(
        Product,
        and_(Product.id == Lead.product_id, Product.organization_id == ctx.tenant_uuid, Product.deleted_at.is_(None)),
    ).where(
        Lead.id.in_(select(filtered_ids.c.id))
    ).order_by(Lead.created_at.desc()).limit(_limit(args))
    rows = (await session.execute(rows_stmt)).all()
    return {
        "total": total,
        "total_count": total,
        "returned": len(rows),
        "summary": f"Found {total} matching leads (showing {len(rows)} records)",
        "records": [{
            "name": lead.name,
            "company": lead.company or "N/A",
            "status": lead.status,
            "source": lead.source or "N/A",
            "score": lead.score,
            "campaign": campaign_name or "N/A",
            "product": product_name or "N/A",
            "created_at": lead.created_at.strftime("%Y-%m-%d") if lead.created_at else None,
        } for lead, campaign_name, product_name in rows],
    }


async def search_deals(session: AsyncSession, ctx: RequestContext, args: dict[str, Any]) -> dict[str, Any]:
    bounds = _date_bounds(args)
    visible_ids = await _visible_user_ids(session, ctx)
    base = select(Deal, Account.name.label("account_name")).join(Account, Account.id == Deal.account_id).where(
        Deal.organization_id == ctx.tenant_uuid,
        Account.organization_id == ctx.tenant_uuid,
        Account.deleted_at.is_(None),
        *_deal_scope(visible_ids),
    )
    base = _apply_deal_filters(base, args, bounds, visible_ids, ctx.tenant_uuid)
    count_stmt = select(func.count()).select_from(base.order_by(None).subquery())
    total = int((await session.execute(count_stmt)).scalar_one())
    rows_stmt = base.order_by(Deal.created_at.desc()).limit(_limit(args))
    rows = (await session.execute(rows_stmt)).all()
    total_amount = sum(float(deal.amount or 0) for deal, _ in rows)
    return {
        "total": total,
        "total_count": total,
        "returned": len(rows),
        "total_amount": round(total_amount, 2),
        "summary": f"Found {total} matching deals (showing {len(rows)} records, total value ${total_amount:,.0f})",
        "records": [{
            "deal": deal.name,
            "account": account_name or "N/A",
            "stage": deal.stage,
            "status": deal.status,
            "amount": float(deal.amount or 0),
            "currency": deal.currency,
            "close_date": deal.close_date.isoformat() if deal.close_date else None,
            "created_at": deal.created_at.strftime("%Y-%m-%d") if deal.created_at else None,
        } for deal, account_name in rows],
    }


async def get_leads_summary(session: AsyncSession, ctx: RequestContext, args: dict[str, Any]) -> dict[str, Any]:
    """Calculate aggregate lead counts, conversion rate, status and source breakdowns."""
    bounds = _date_bounds(args)
    visible_ids = await _visible_user_ids(session, ctx)
    base = select(Lead)
    base = _apply_lead_filters(base, args, bounds, visible_ids, ctx.tenant_uuid)

    # 1. Total leads & average score
    totals_stmt = select(
        func.count(Lead.id).label("total"),
        func.coalesce(func.avg(Lead.score), 0).label("avg_score"),
        func.count(case((Lead.score >= 80, 1))).label("hot_leads"),
        func.count(case((func.lower(Lead.status) == "qualified", 1))).label("qualified_leads"),
        func.count(case((func.lower(Lead.status).in_(["converted", "customer"]), 1))).label("converted_leads"),
    ).where(
        Lead.organization_id == ctx.tenant_uuid,
        Lead.deleted_at.is_(None),
        *_lead_scope(visible_ids),
    )
    totals_stmt = _apply_lead_filters(select(Lead), args, bounds, visible_ids, ctx.tenant_uuid).with_only_columns(
        func.count(Lead.id).label("total"),
        func.coalesce(func.avg(Lead.score), 0).label("avg_score"),
        func.count(case((Lead.score >= 80, 1))).label("hot_leads"),
        func.count(case((func.lower(Lead.status) == "qualified", 1))).label("qualified_leads"),
        func.count(case((func.lower(Lead.status).in_(["converted", "customer"]), 1))).label("converted_leads"),
    )
    tot_row = (await session.execute(totals_stmt)).one()
    total = int(tot_row.total or 0)
    avg_score = round(float(tot_row.avg_score or 0), 1)
    hot_leads = int(tot_row.hot_leads or 0)
    qualified = int(tot_row.qualified_leads or 0)
    converted = int(tot_row.converted_leads or 0)

    # 2. Status breakdown
    status_stmt = _apply_lead_filters(select(Lead), args, bounds, visible_ids, ctx.tenant_uuid).with_only_columns(
        Lead.status,
        func.count(Lead.id),
    ).group_by(Lead.status).order_by(func.count(Lead.id).desc())
    status_rows = (await session.execute(status_stmt)).all()
    by_status = {str(row[0]): int(row[1]) for row in status_rows if row[0]}

    # 3. Source breakdown
    source_stmt = _apply_lead_filters(select(Lead), args, bounds, visible_ids, ctx.tenant_uuid).with_only_columns(
        func.coalesce(Lead.source, "Direct / Referral"),
        func.count(Lead.id),
    ).group_by(func.coalesce(Lead.source, "Direct / Referral")).order_by(func.count(Lead.id).desc()).limit(8)
    source_rows = (await session.execute(source_stmt)).all()
    by_source = {str(row[0]): int(row[1]) for row in source_rows}

    conversion_rate = round(converted / max(1, total) * 100, 1) if total else 0.0

    return {
        "total_leads": total,
        "total_count": total,
        "average_score": avg_score,
        "hot_leads_count": hot_leads,
        "qualified_leads_count": qualified,
        "converted_leads_count": converted,
        "conversion_rate_pct": conversion_rate,
        "by_status": by_status,
        "by_source": by_source,
    }


async def get_team_performance(session: AsyncSession, ctx: RequestContext, args: dict[str, Any]) -> dict[str, Any]:
    """Calculate sales team metrics: won deals, revenue, open pipeline and win rates per rep."""
    bounds = _date_bounds(args)
    visible_ids = await _visible_user_ids(session, ctx)

    users_stmt = select(User).where(
        User.organization_id == ctx.tenant_uuid,
        User.deleted_at.is_(None),
    )
    if visible_ids is not None:
        users_stmt = users_stmt.where(User.id.in_(visible_ids))
    users = (await session.execute(users_stmt)).scalars().all()
    user_map = {u.id: (u.name or u.email) for u in users}

    if not user_map:
        return {"total_reps": 0, "performers": []}

    u_ids = list(user_map.keys())

    # Deals by owner
    d_stmt = select(
        Deal.owner_id,
        func.count(Deal.id).label("total_deals"),
        func.count(case((func.lower(Deal.status) == "won", 1))).label("won_deals"),
        func.coalesce(func.sum(case((func.lower(Deal.status) == "won", Deal.amount))), 0).label("won_rev"),
        func.coalesce(func.sum(case((func.lower(Deal.status) == "open", Deal.amount))), 0).label("pipe_val"),
    ).where(
        Deal.organization_id == ctx.tenant_uuid,
        Deal.deleted_at.is_(None),
        Deal.owner_id.in_(u_ids),
    )
    d_stmt = _apply_created_at(d_stmt, Deal.created_at, bounds)
    deal_rows = (await session.execute(d_stmt.group_by(Deal.owner_id))).all()
    deals_by_user = {row[0]: row for row in deal_rows}

    # Leads by assignee
    l_stmt = select(
        Lead.assigned_to,
        func.count(Lead.id).label("total_leads"),
        func.count(case((func.lower(Lead.status) == "qualified", 1))).label("qual_leads"),
    ).where(
        Lead.organization_id == ctx.tenant_uuid,
        Lead.deleted_at.is_(None),
        Lead.assigned_to.in_(u_ids),
    )
    l_stmt = _apply_created_at(l_stmt, Lead.created_at, bounds)
    lead_rows = (await session.execute(l_stmt.group_by(Lead.assigned_to))).all()
    leads_by_user = {row[0]: row for row in lead_rows}

    performers = []
    total_won_revenue = 0.0
    for uid, name in user_map.items():
        d_row = deals_by_user.get(uid)
        l_row = leads_by_user.get(uid)
        tot_d = int(d_row[1]) if d_row else 0
        won_d = int(d_row[2]) if d_row else 0
        won_val = float(d_row[3]) if d_row else 0.0
        pipe_val = float(d_row[4]) if d_row else 0.0
        tot_l = int(l_row[1]) if l_row else 0
        qual_l = int(l_row[2]) if l_row else 0
        win_rate = round(won_d / max(1, tot_d) * 100, 1) if tot_d else 0.0
        total_won_revenue += won_val

        performers.append({
            "name": name,
            "won_revenue": won_val,
            "won_deals": won_d,
            "pipeline_value": pipe_val,
            "total_deals": tot_d,
            "assigned_leads": tot_l,
            "qualified_leads": qual_l,
            "win_rate_pct": win_rate,
        })

    performers.sort(key=lambda x: (x["won_revenue"], x["pipeline_value"], x["won_deals"]), reverse=True)
    return {
        "total_reps": len(performers),
        "total_team_won_revenue": round(total_won_revenue, 2),
        "performers": performers[:15],
    }


async def get_crm_overview(session: AsyncSession, ctx: RequestContext, args: dict[str, Any]) -> dict[str, Any]:
    """Calculate executive CRM business health KPIs in one fast call."""
    bounds = _date_bounds(args)
    visible_ids = await _visible_user_ids(session, ctx)

    d_base = select(
        func.count(Deal.id).label("total_deals"),
        func.count(case((func.lower(Deal.status) == "open", 1))).label("open_deals"),
        func.count(case((func.lower(Deal.status) == "won", 1))).label("won_deals"),
        func.coalesce(func.sum(case((func.lower(Deal.status) == "open", Deal.amount))), 0).label("pipeline_value"),
        func.coalesce(func.sum(case((func.lower(Deal.status) == "won", Deal.amount))), 0).label("won_revenue"),
    ).where(
        Deal.organization_id == ctx.tenant_uuid,
        Deal.deleted_at.is_(None),
        *_deal_scope(visible_ids),
    )
    d_base = _apply_created_at(d_base, Deal.created_at, bounds)
    d_row = (await session.execute(d_base)).one()

    l_base = select(
        func.count(Lead.id).label("total_leads"),
        func.count(case((func.lower(Lead.status) == "qualified", 1))).label("qual_leads"),
        func.count(case((func.lower(Lead.status).in_(["converted", "customer"]), 1))).label("conv_leads"),
        func.coalesce(func.avg(Lead.score), 0).label("avg_score"),
    ).where(
        Lead.organization_id == ctx.tenant_uuid,
        Lead.deleted_at.is_(None),
        *_lead_scope(visible_ids),
    )
    l_base = _apply_created_at(l_base, Lead.created_at, bounds)
    l_row = (await session.execute(l_base)).one()

    total_leads = int(l_row.total_leads or 0)
    converted_leads = int(l_row.conv_leads or 0)
    total_deals = int(d_row.total_deals or 0)
    won_deals = int(d_row.won_deals or 0)

    return {
        "active_pipeline_value": float(d_row.pipeline_value or 0),
        "total_won_revenue": float(d_row.won_revenue or 0),
        "open_deals_count": int(d_row.open_deals or 0),
        "won_deals_count": won_deals,
        "total_deals_count": total_deals,
        "deal_win_rate_pct": round(won_deals / max(1, total_deals) * 100, 1) if total_deals else 0.0,
        "total_leads_count": total_leads,
        "qualified_leads_count": int(l_row.qual_leads or 0),
        "converted_leads_count": converted_leads,
        "lead_conversion_rate_pct": round(converted_leads / max(1, total_leads) * 100, 1) if total_leads else 0.0,
        "average_lead_score": round(float(l_row.avg_score or 0), 1),
    }


async def get_pipeline_summary(session: AsyncSession, ctx: RequestContext, args: dict[str, Any]) -> dict[str, Any]:
    bounds = _date_bounds(args)
    visible_ids = await _visible_user_ids(session, ctx)
    base = select(Deal.stage, Deal.currency, func.count(Deal.id), func.coalesce(func.sum(Deal.amount), 0)).join(
        Account, Account.id == Deal.account_id
    ).where(
        Deal.organization_id == ctx.tenant_uuid,
        Deal.deleted_at.is_(None),
        Account.organization_id == ctx.tenant_uuid,
        Account.deleted_at.is_(None),
        *_deal_scope(visible_ids),
    )
    base = _apply_deal_filters(base, args, bounds, visible_ids, ctx.tenant_uuid)
    rows = (await session.execute(base.group_by(Deal.stage, Deal.currency).order_by(Deal.stage.asc()))).all()
    weighted_probability = case(
        (func.lower(Deal.stage).in_(["won", "closed won", "closed_won"]), 100),
        (func.lower(Deal.stage).in_(["lost", "closed lost", "closed_lost"]), 0),
        else_=func.coalesce(Opportunity.probability, 50),
    )
    weighted_stmt = select(
        Deal.currency,
        func.coalesce(func.sum(Deal.amount * weighted_probability / 100.0), 0),
    ).outerjoin(Opportunity, Opportunity.id == Deal.opportunity_id).join(
        Account, Account.id == Deal.account_id
    ).where(
        Deal.organization_id == ctx.tenant_uuid,
        Deal.deleted_at.is_(None),
        Account.organization_id == ctx.tenant_uuid,
        Account.deleted_at.is_(None),
        *_deal_scope(visible_ids),
    )
    weighted_stmt = _apply_deal_filters(weighted_stmt, args, bounds, visible_ids, ctx.tenant_uuid)
    weighted_rows = (await session.execute(weighted_stmt.group_by(Deal.currency))).all()
    return {
        "by_stage": [{"stage": str(stage), "currency": currency, "deal_count": int(count), "pipeline_value": float(value or 0)} for stage, currency, count, value in rows],
        "weighted_value_by_currency": [{"currency": currency, "weighted_pipeline_value": float(value or 0)} for currency, value in weighted_rows],
    }


async def get_campaign_performance(session: AsyncSession, ctx: RequestContext, args: dict[str, Any]) -> dict[str, Any]:
    bounds = _date_bounds(args)
    visible_ids = await _visible_user_ids(session, ctx)
    stmt = select(
        Campaign.name, Campaign.type, Campaign.status, Campaign.budget,
        func.count(func.distinct(Lead.id)).label("lead_count"),
    ).join(Lead, Lead.campaign_id == Campaign.id).where(
        Campaign.organization_id == ctx.tenant_uuid,
        Campaign.deleted_at.is_(None),
        Lead.organization_id == ctx.tenant_uuid,
        Lead.deleted_at.is_(None),
        *_lead_scope(visible_ids),
    )
    campaign_name = _safe_text(args.get("campaign"))
    if campaign_name:
        stmt = stmt.where(Campaign.name.ilike(f"%{campaign_name}%"))
    status = _safe_text(args.get("status"), max_length=30)
    if status:
        stmt = stmt.where(func.lower(Campaign.status) == status.lower())
    stmt = _apply_created_at(stmt, Lead.created_at, bounds)
    stmt = stmt.group_by(Campaign.name, Campaign.type, Campaign.status, Campaign.budget).order_by(
        func.count(func.distinct(Lead.id)).desc()
    ).limit(_limit(args))
    rows = (await session.execute(stmt)).all()
    return {"total_returned": len(rows), "campaigns": [{
        "campaign": name, "type": kind, "status": campaign_status,
        "budget": float(budget or 0), "lead_count": int(lead_count or 0),
    } for name, kind, campaign_status, budget, lead_count in rows]}


async def get_product_performance(session: AsyncSession, ctx: RequestContext, args: dict[str, Any]) -> dict[str, Any]:
    bounds = _date_bounds(args)
    visible_ids = await _visible_user_ids(session, ctx)
    product_name = _safe_text(args.get("product"))
    product_query = select(Product.id, Product.name, Product.category, Product.price, Product.currency).where(
        Product.organization_id == ctx.tenant_uuid,
        Product.deleted_at.is_(None),
    )
    if product_name:
        product_query = product_query.where(Product.name.ilike(f"%{product_name}%"))
    product_rows = (await session.execute(product_query.order_by(Product.name.asc()).limit(_limit(args)))).all()
    products = {row.id: {"product": row.name, "category": row.category, "list_price": float(row.price or 0), "currency": row.currency, "lead_count": 0, "deal_count": 0, "deal_value": 0.0} for row in product_rows}
    if not products:
        return {"products": []}

    lead_stmt = select(Lead.product_id, func.count(Lead.id)).where(
        Lead.organization_id == ctx.tenant_uuid,
        Lead.deleted_at.is_(None),
        Lead.product_id.in_(list(products.keys())),
        *_lead_scope(visible_ids),
    )
    lead_stmt = _apply_created_at(lead_stmt, Lead.created_at, bounds)
    lead_counts = (await session.execute(lead_stmt.group_by(Lead.product_id))).all()
    for product_id, count in lead_counts:
        if product_id in products:
            products[product_id]["lead_count"] = int(count or 0)

    deal_stmt = select(
        DealProduct.product_id, Deal.currency, func.count(func.distinct(Deal.id)),
        func.coalesce(func.sum(Deal.amount), 0),
    ).join(Deal, Deal.id == DealProduct.deal_id).where(
        Deal.organization_id == ctx.tenant_uuid,
        Deal.deleted_at.is_(None),
        DealProduct.product_id.in_(list(products.keys())),
        *_deal_scope(visible_ids),
    )
    deal_stmt = _apply_created_at(deal_stmt, Deal.created_at, bounds)
    deal_rows = (await session.execute(deal_stmt.group_by(DealProduct.product_id, Deal.currency))).all()
    currency_totals: dict[uuid.UUID, list[dict[str, Any]]] = {}
    for product_id, currency, count, value in deal_rows:
        if product_id in products:
            currency_totals.setdefault(product_id, []).append({
                "currency": currency,
                "deal_count": int(count or 0),
                "deal_value": float(value or 0),
            })
    for product_id, product_info in products.items():
        product_info["deal_totals_by_currency"] = currency_totals.get(product_id, [])
        product_info["deal_count"] = sum(item["deal_count"] for item in product_info["deal_totals_by_currency"])
    return {"products": list(products.values())}


async def get_account_summary(session: AsyncSession, ctx: RequestContext, args: dict[str, Any]) -> dict[str, Any]:
    bounds = _date_bounds(args)
    visible_ids = await _visible_user_ids(session, ctx)
    account_name = _safe_text(args.get("account")) or _safe_text(args.get("search"))
    stmt = select(
        Account.name, Account.industry, Deal.currency,
        func.count(Deal.id), func.coalesce(func.sum(Deal.amount), 0),
    ).join(Deal, Deal.account_id == Account.id).where(
        Account.organization_id == ctx.tenant_uuid,
        Account.deleted_at.is_(None),
        Deal.organization_id == ctx.tenant_uuid,
        Deal.deleted_at.is_(None),
        *_deal_scope(visible_ids),
    )
    if account_name:
        stmt = stmt.where(Account.name.ilike(f"%{account_name}%"))
    stmt = _apply_created_at(stmt, Deal.created_at, bounds)
    stmt = stmt.group_by(Account.name, Account.industry, Deal.currency).order_by(
        func.sum(Deal.amount).desc()
    ).limit(_limit(args))
    rows = (await session.execute(stmt)).all()
    return {"accounts": [{
        "account": name, "industry": industry, "currency": currency,
        "deal_count": int(count), "deal_value": float(value or 0),
    } for name, industry, currency, count, value in rows]}


async def search_contacts(session: AsyncSession, ctx: RequestContext, args: dict[str, Any]) -> dict[str, Any]:
    """Search tenant contacts, constrained to accounts visible through scoped CRM deals/leads."""
    visible_ids = await _visible_user_ids(session, ctx)
    search = _safe_text(args.get("search"), max_length=100)
    account_name = _safe_text(args.get("account"), max_length=100)
    stmt = select(Contact, Account.name.label("account_name")).join(
        Account, Account.id == Contact.account_id
    ).where(
        Account.organization_id == ctx.tenant_uuid,
        Account.deleted_at.is_(None),
    )
    # For non-owner roles, only expose contacts linked to accounts that have
    # at least one visible deal or lead. This prevents tenant-wide contact leakage.
    if visible_ids is not None:
        visible_account_ids = select(Deal.account_id).where(
            Deal.organization_id == ctx.tenant_uuid,
            Deal.deleted_at.is_(None),
            *_deal_scope(visible_ids),
        )
        stmt = stmt.where(Contact.account_id.in_(visible_account_ids))
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(or_(
            Contact.first_name.ilike(pattern),
            Contact.last_name.ilike(pattern),
            Contact.email.ilike(pattern),
            Contact.title.ilike(pattern),
        ))
    if account_name:
        stmt = stmt.where(Account.name.ilike(f"%{account_name}%"))
    rows = (await session.execute(
        stmt.order_by(Contact.first_name.asc(), Contact.last_name.asc()).limit(_limit(args))
    )).all()
    return {"returned": len(rows), "contacts": [{
        "name": f"{contact.first_name} {contact.last_name}".strip(),
        "account": account, "title": contact.title, "department": contact.department,
        "email": contact.email, "phone": contact.phone,
    } for contact, account in rows]}


async def search_activities(session: AsyncSession, ctx: RequestContext, args: dict[str, Any]) -> dict[str, Any]:
    """Search tasks, calls, meetings and emails within the authenticated user's scope."""
    bounds = _date_bounds(args)
    visible_ids = await _visible_user_ids(session, ctx)
    stmt = select(Activity).where(
        Activity.organization_id == ctx.tenant_uuid,
    )
    if visible_ids is not None:
        if not visible_ids:
            stmt = stmt.where(Activity.id.is_(None))
        else:
            stmt = stmt.where(Activity.user_id.in_(visible_ids))
    activity_type = _safe_text(args.get("type"), max_length=30)
    status = _safe_text(args.get("status"), max_length=30)
    priority = _safe_text(args.get("priority"), max_length=20)
    search = _safe_text(args.get("search"), max_length=100)
    if activity_type:
        stmt = stmt.where(func.lower(Activity.type) == activity_type.lower())
    if status:
        stmt = stmt.where(func.lower(Activity.status) == status.lower())
    if priority:
        stmt = stmt.where(func.lower(Activity.priority) == priority.lower())
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(or_(Activity.subject.ilike(pattern), Activity.description.ilike(pattern)))
    stmt = _apply_created_at(stmt, Activity.start_at, bounds)
    rows = (await session.execute(
        stmt.order_by(Activity.start_at.asc().nullslast()).limit(_limit(args))
    )).scalars().all()
    return {"returned": len(rows), "activities": [{
        "subject": activity.subject, "type": activity.type, "status": activity.status,
        "priority": activity.priority,
        "start_at": activity.start_at.isoformat() if activity.start_at else None,
        "description": (activity.description or "")[:500],
    } for activity in rows]}


TOOL_FUNCTIONS = {
    "get_leads_summary": get_leads_summary,
    "get_team_performance": get_team_performance,
    "get_crm_overview": get_crm_overview,
    "search_leads": search_leads,
    "search_deals": search_deals,
    "get_pipeline_summary": get_pipeline_summary,
    "get_campaign_performance": get_campaign_performance,
    "get_product_performance": get_product_performance,
    "get_account_summary": get_account_summary,
    "search_contacts": search_contacts,
    "search_activities": search_activities,
}


async def execute_crm_tool(session: AsyncSession, ctx: RequestContext, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    """Execute one allow-listed, read-only CRM tool."""
    function = TOOL_FUNCTIONS.get(name)
    if function is None:
        return {"error": "Unknown CRM data tool"}
    if not isinstance(arguments, dict):
        return {"error": "Tool arguments must be an object"}
    try:
        return await function(session, ctx, arguments)
    except ValueError as exc:
        return {"error": str(exc)}
    except SQLAlchemyError as exc:
        import logging
        logging.getLogger(__name__).exception("SQLAlchemyError in execute_crm_tool '%s': %s", name, exc)
        return {"error": f"CRM data could not be retrieved: {str(exc.__cause__ or exc)}"}


CRM_TOOL_DEFINITIONS = [
    {"type": "function", "function": {"name": "get_crm_overview", "description": "Calculate high-level executive CRM business health KPIs: total active pipeline value, closed won revenue, open vs won deal counts, total leads, qualified leads, and conversion rate in one fast call. Use when user asks for overall CRM performance, executive summary, or business health.", "parameters": {"type": "object", "properties": {"date_range": {"type": "string", "enum": ["today", "yesterday", "this_week", "last_week", "last_7_days", "last_30_days", "last_90_days", "this_month", "this_quarter", "this_year", "all_time"]}, "created_after": {"type": "string"}, "created_before": {"type": "string"}}, "additionalProperties": False}}},
    {"type": "function", "function": {"name": "get_leads_summary", "description": "Calculate aggregate lead counts, conversion rate, breakdown by status, breakdown by source, and average lead scores. ALWAYS prefer this tool over search_leads for questions about lead counts, status breakdowns, sources, or overall lead health.", "parameters": {"type": "object", "properties": {"status": {"type": "string"}, "source": {"type": "string"}, "campaign": {"type": "string"}, "product": {"type": "string"}, "date_range": {"type": "string", "enum": ["today", "yesterday", "this_week", "last_week", "last_7_days", "last_30_days", "last_90_days", "this_month", "this_quarter", "this_year", "all_time"]}, "created_after": {"type": "string"}, "created_before": {"type": "string"}}, "additionalProperties": False}}},
    {"type": "function", "function": {"name": "get_team_performance", "description": "Summarize sales team and sales rep performance: deals won, total closed revenue, active open pipeline, win rates, and assigned lead counts per rep. Use whenever the user asks about top sales reps, team performance, rep rankings, or sales quotas.", "parameters": {"type": "object", "properties": {"date_range": {"type": "string", "enum": ["today", "yesterday", "this_week", "last_week", "last_7_days", "last_30_days", "last_90_days", "this_month", "this_quarter", "this_year", "all_time"]}, "created_after": {"type": "string"}, "created_before": {"type": "string"}}, "additionalProperties": False}}},
    {"type": "function", "function": {"name": "get_pipeline_summary", "description": "Calculate CRM pipeline deal counts and values grouped by stage and currency, including weighted pipeline values. Accepts the same deal filters as search_deals except account and search.", "parameters": {"type": "object", "properties": {"stage": {"type": "string"}, "status": {"type": "string"}, "owner": {"type": "string", "description": "Deal owner name or UUID; results remain role-scoped"}, "campaign": {"type": "string"}, "product": {"type": "string"}, "currency": {"type": "string"}, "min_amount": {"type": "number"}, "max_amount": {"type": "number"}, "date_range": {"type": "string", "enum": ["today", "yesterday", "this_week", "last_week", "last_7_days", "last_30_days", "last_90_days", "this_month", "this_quarter", "this_year", "all_time"]}, "created_after": {"type": "string"}, "created_before": {"type": "string"}}, "additionalProperties": False}}},
    {"type": "function", "function": {"name": "search_leads", "description": "Search CRM leads using optional status, source, score, campaign, product, text, and created-date filters. Only return leads visible to the authenticated user's role.", "parameters": {"type": "object", "properties": {"status": {"type": "string"}, "source": {"type": "string"}, "assigned_to": {"type": "string", "description": "Assignee name or UUID; results remain role-scoped"}, "min_score": {"type": "integer"}, "max_score": {"type": "integer"}, "campaign": {"type": "string", "description": "Campaign name or UUID"}, "product": {"type": "string", "description": "Product name or UUID"}, "search": {"type": "string"}, "date_range": {"type": "string", "enum": ["today", "yesterday", "this_week", "last_week", "last_7_days", "last_30_days", "last_90_days", "this_month", "this_quarter", "this_year", "all_time"]}, "created_after": {"type": "string", "description": "ISO date or datetime"}, "created_before": {"type": "string", "description": "ISO date or datetime"}, "limit": {"type": "integer", "minimum": 1, "maximum": 50}}, "additionalProperties": False}}},
    {"type": "function", "function": {"name": "search_deals", "description": "Search CRM deals with optional stage, status, account, campaign, product, currency, amount, text, and created-date filters. Only return deals visible to the authenticated user's role.", "parameters": {"type": "object", "properties": {"stage": {"type": "string"}, "status": {"type": "string"}, "account": {"type": "string"}, "owner": {"type": "string", "description": "Deal owner name or UUID; results remain role-scoped"}, "campaign": {"type": "string"}, "product": {"type": "string"}, "currency": {"type": "string"}, "min_amount": {"type": "number"}, "max_amount": {"type": "number"}, "search": {"type": "string"}, "date_range": {"type": "string", "enum": ["today", "yesterday", "this_week", "last_week", "last_7_days", "last_30_days", "last_90_days", "this_month", "this_quarter", "this_year", "all_time"]}, "created_after": {"type": "string"}, "created_before": {"type": "string"}, "limit": {"type": "integer", "minimum": 1, "maximum": 50}}, "additionalProperties": False}}},
    {"type": "function", "function": {"name": "get_campaign_performance", "description": "Summarize campaigns by type, status, budget, and lead count visible to the authenticated user, with optional campaign, status, and date filters.", "parameters": {"type": "object", "properties": {"campaign": {"type": "string"}, "status": {"type": "string"}, "date_range": {"type": "string", "enum": ["today", "yesterday", "this_week", "last_week", "last_7_days", "last_30_days", "last_90_days", "this_month", "this_quarter", "this_year", "all_time"]}, "created_after": {"type": "string"}, "created_before": {"type": "string"}, "limit": {"type": "integer", "minimum": 1, "maximum": 50}}, "additionalProperties": False}}},
    {"type": "function", "function": {"name": "get_product_performance", "description": "Summarize products with visible lead counts and deal counts and values, with optional product and date filters.", "parameters": {"type": "object", "properties": {"product": {"type": "string"}, "date_range": {"type": "string", "enum": ["today", "yesterday", "this_week", "last_week", "last_7_days", "last_30_days", "last_90_days", "this_month", "this_quarter", "this_year", "all_time"]}, "created_after": {"type": "string"}, "created_before": {"type": "string"}, "limit": {"type": "integer", "minimum": 1, "maximum": 50}}, "additionalProperties": False}}},
    {"type": "function", "function": {"name": "get_account_summary", "description": "Summarize accounts by visible associated deals, deal counts and deal values, with optional account and created-date filters.", "parameters": {"type": "object", "properties": {"account": {"type": "string"}, "search": {"type": "string"}, "date_range": {"type": "string", "enum": ["today", "yesterday", "this_week", "last_week", "last_7_days", "last_30_days", "last_90_days", "this_month", "this_quarter", "this_year", "all_time"]}, "created_after": {"type": "string"}, "created_before": {"type": "string"}, "limit": {"type": "integer", "minimum": 1, "maximum": 50}}, "additionalProperties": False}}},
    {"type": "function", "function": {"name": "search_contacts", "description": "Search CRM contacts by name, email, title or account. Results are tenant- and role-scoped.", "parameters": {"type": "object", "properties": {"search": {"type": "string"}, "account": {"type": "string"}, "limit": {"type": "integer", "minimum": 1, "maximum": 50}}, "additionalProperties": False}}},
    {"type": "function", "function": {"name": "search_activities", "description": "Search CRM tasks, calls, meetings and emails by type, status, priority, text and date range. Results are tenant- and role-scoped.", "parameters": {"type": "object", "properties": {"type": {"type": "string", "enum": ["task", "call", "meeting", "email"]}, "status": {"type": "string"}, "priority": {"type": "string"}, "search": {"type": "string"}, "date_range": {"type": "string", "enum": ["today", "yesterday", "this_week", "last_week", "last_7_days", "last_30_days", "last_90_days", "this_month", "this_quarter", "this_year", "all_time"]}, "created_after": {"type": "string"}, "created_before": {"type": "string"}, "limit": {"type": "integer", "minimum": 1, "maximum": 50}}, "additionalProperties": False}}},
]
