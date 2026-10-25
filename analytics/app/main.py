from contextlib import asynccontextmanager
import csv
import io
from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncConnection
from app.analytics import (PERIODS, overview, revenue_trend, pipeline_by_stage, lead_sources, conversion_funnel, activity_performance, quota_leaderboard, target_pace)
from app.database import get_connection, database_ready, dispose_engine
from app.tenant import resolve_organization_id
from app.config import get_settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await dispose_engine()

app = FastAPI(title="Dakini CRM Layer 9 Analytics", version="1.0.0", lifespan=lifespan)

@app.get("/health", tags=["health"])
async def health():
    if not await database_ready():
        raise HTTPException(status_code=503, detail="Database unavailable")
    return {"status": "ok", "service": "layer9-analytics", "database": "ready"}

def empty_overview(period: str) -> dict:
    """Zero-valued response for local development when no tenant exists."""
    from app.analytics import period_bounds
    from datetime import timedelta

    start, end = period_bounds(period)
    return {
        "period": period,
        "start_date": start.isoformat(),
        "end_date": (end - timedelta(days=1)).isoformat(),
        "total_leads": 0,
        "converted_leads": 0,
        "conversion_metric_available": False,
        "lead_conversion_rate_percent": 0.0,
        "open_opportunities": 0,
        "open_pipeline_value": 0.0,
        "deals_won": 0,
        "closed_won_revenue": 0.0,
        "activity_count": 0,
        "currency_note": "No tenant data available; values are zero placeholders.",
        "data_status": "empty_tenant_fallback",
    }

def empty_revenue_trend(months: int) -> dict:
    from datetime import date, datetime, timezone

    today = datetime.now(timezone.utc).date()
    current = date(today.year, today.month, 1)
    for _ in range(months - 1):
        current = date(current.year - (1 if current.month == 1 else 0), 12 if current.month == 1 else current.month - 1, 1)
    data = []
    for _ in range(months):
        data.append({"month": current.isoformat(), "revenue": 0.0, "deals_won": 0})
        current = date(current.year + (1 if current.month == 12 else 0), 1 if current.month == 12 else current.month + 1, 1)
    return {"months": months, "data": data, "currency_note": "No tenant data available; values are zero placeholders.", "data_status": "empty_tenant_fallback"}

def allow_empty_tenant_fallback(exc: HTTPException) -> bool:
    # Explicitly opt in for local/dev environments only; production tenant isolation stays strict by default.
    return exc.status_code == 404 and get_settings().allow_empty_tenant

def checked_period(value: str) -> str:
    if value not in PERIODS:
        raise HTTPException(status_code=422, detail=f"period must be one of {sorted(PERIODS)}")
    return value

@app.get("/v1/reports/overview", tags=["reports"])
async def get_overview(period: str = Query("month"), conn: AsyncConnection = Depends(get_connection),
                       tenant_id: str = Header(alias="X-Tenant-Id")):
    period = checked_period(period)
    try:
        org = await resolve_organization_id(conn, tenant_id)
    except HTTPException as exc:
        if allow_empty_tenant_fallback(exc):
            return empty_overview(period)
        raise
    try:
        return await overview(conn, org, period)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

@app.get("/v1/reports/revenue-trend", tags=["reports"])
async def get_revenue_trend(months: int = Query(6, ge=1, le=24),
                            conn: AsyncConnection = Depends(get_connection),
                            tenant_id: str = Header(alias="X-Tenant-Id")):
    try:
        org = await resolve_organization_id(conn, tenant_id)
    except HTTPException as exc:
        if allow_empty_tenant_fallback(exc):
            return empty_revenue_trend(months)
        raise
    try:
        return await revenue_trend(conn, org, months)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

@app.get("/v1/reports/pipeline-by-stage", tags=["reports"])
async def get_pipeline_by_stage(conn: AsyncConnection = Depends(get_connection),
                                tenant_id: str = Header(alias="X-Tenant-Id")):
    try:
        org = await resolve_organization_id(conn, tenant_id)
    except HTTPException as exc:
        if allow_empty_tenant_fallback(exc):
            return {"data": [], "data_status": "empty_tenant_fallback"}
        raise
    try:
        return await pipeline_by_stage(conn, org)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

@app.get("/v1/reports/lead-sources", tags=["reports"])
async def get_lead_sources(period: str = Query("last_30_days"),
                           conn: AsyncConnection = Depends(get_connection),
                           tenant_id: str = Header(alias="X-Tenant-Id")):
    period = checked_period(period)
    try:
        org = await resolve_organization_id(conn, tenant_id)
    except HTTPException as exc:
        if allow_empty_tenant_fallback(exc):
            return {"period": period, "data": [], "data_status": "empty_tenant_fallback"}
        raise
    try:
        return await lead_sources(conn, org, period)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def _csv_value(value):
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        import json
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return value


def report_to_csv(report: str, payload: dict) -> str:
    """Convert report data into a stable CSV; activity exports include each breakdown."""
    output = io.StringIO(newline="")

    if report == "overview":
        flat = {
            key: _csv_value(value)
            for key, value in payload.items()
            if not isinstance(value, (list, dict))
        }
        if isinstance(payload.get("closed_won_revenue_by_currency"), dict):
            flat["closed_won_revenue_by_currency"] = _csv_value(payload["closed_won_revenue_by_currency"])
        writer = csv.DictWriter(output, fieldnames=list(flat.keys()) or ["data_status"])
        writer.writeheader()
        writer.writerow(flat or {"data_status": payload.get("data_status", "empty")})
        return output.getvalue()

    if report == "activity-performance":
        rows = []
        for entry in payload.get("by_type", []):
            rows.append({"breakdown": "type", "label": entry.get("type"), "count": entry.get("count")})
        for entry in payload.get("by_status", []):
            rows.append({"breakdown": "status", "label": entry.get("status"), "count": entry.get("count")})
        for entry in payload.get("by_owner", []):
            rows.append({
                "breakdown": "owner",
                "label": entry.get("name"),
                "user_id": entry.get("user_id"),
                "count": entry.get("activity_count"),
                "completed_count": entry.get("completed_count"),
            })
        rows.insert(0, {
            "breakdown": "summary",
            "label": "all activities",
            "count": payload.get("total_activities", 0),
            "completed_count": payload.get("completed_activities", 0),
            "completion_rate_percent": payload.get("completion_rate_percent", 0),
        })
        rows_data = rows
    else:
        data_keys = {
            "lead-sources": "data",
            "pipeline-by-stage": "data",
            "conversion-funnel": "data",
            "quota-leaderboard": "data",
            "target-pace": "data",
            "revenue-trend": "data",
        }
        rows_data = payload.get(data_keys.get(report, ""), [])
        if report == "lead-sources" and isinstance(rows_data, list):
            total = int(payload.get("total_leads") or sum(int(row.get("lead_count") or 0) for row in rows_data if isinstance(row, dict)))
            for row in rows_data:
                if isinstance(row, dict):
                    count = int(row.get("lead_count") or 0)
                    row["percentage"] = round(count * 100 / total, 2) if total else 0.0

    if isinstance(rows_data, list) and rows_data:
        keys = list(dict.fromkeys(k for row in rows_data if isinstance(row, dict) for k in row.keys()))
        writer = csv.DictWriter(output, fieldnames=keys or ["data_status"], extrasaction="ignore")
        writer.writeheader()
        for row in rows_data:
            if isinstance(row, dict):
                writer.writerow({key: _csv_value(row.get(key)) for key in keys})
    else:
        # Empty reports still emit a stable one-row file for auditing and automation.
        flat = {
            key: _csv_value(value)
            for key, value in payload.items()
            if not isinstance(value, list)
        }
        if not flat:
            flat = {"data_status": payload.get("data_status", "empty")}
        writer = csv.DictWriter(output, fieldnames=list(flat.keys()))
        writer.writeheader()
        writer.writerow(flat)
    return output.getvalue()


@app.get("/v1/reports/conversion-funnel", tags=["reports"])
async def get_conversion_funnel(period: str = Query("last_30_days"),
                                conn: AsyncConnection = Depends(get_connection),
                                tenant_id: str = Header(alias="X-Tenant-Id")):
    period = checked_period(period)
    org = await resolve_organization_id(conn, tenant_id)
    try:
        return await conversion_funnel(conn, org, period)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/v1/reports/activity-performance", tags=["reports"])
async def get_activity_performance(period: str = Query("last_30_days"),
                                   conn: AsyncConnection = Depends(get_connection),
                                   tenant_id: str = Header(alias="X-Tenant-Id")):
    period = checked_period(period)
    org = await resolve_organization_id(conn, tenant_id)
    try:
        return await activity_performance(conn, org, period)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/v1/reports/quota-leaderboard", tags=["reports"])
async def get_quota_leaderboard(period: str = Query("month"),
                                conn: AsyncConnection = Depends(get_connection),
                                tenant_id: str = Header(alias="X-Tenant-Id")):
    period = checked_period(period)
    org = await resolve_organization_id(conn, tenant_id)
    try:
        return await quota_leaderboard(conn, org, period)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/v1/reports/target-pace", tags=["reports"])
async def get_target_pace(period: str = Query("quarter"),
                          conn: AsyncConnection = Depends(get_connection),
                          tenant_id: str = Header(alias="X-Tenant-Id")):
    period = checked_period(period)
    org = await resolve_organization_id(conn, tenant_id)
    try:
        return await target_pace(conn, org, period)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/v1/reports/export.csv", tags=["reports"])
async def export_report_csv(
    report: str = Query(..., pattern="^(overview|revenue-trend|pipeline-by-stage|lead-sources|conversion-funnel|activity-performance|quota-leaderboard|target-pace)$"),
    period: str = Query("month"),
    months: int = Query(6, ge=1, le=24),
    conn: AsyncConnection = Depends(get_connection),
    tenant_id: str = Header(alias="X-Tenant-Id"),
):
    period = checked_period(period)
    org = await resolve_organization_id(conn, tenant_id)
    try:
        if report == "overview":
            payload = await overview(conn, org, period)
        elif report == "revenue-trend":
            payload = await revenue_trend(conn, org, months)
        elif report == "pipeline-by-stage":
            payload = await pipeline_by_stage(conn, org)
        elif report == "lead-sources":
            payload = await lead_sources(conn, org, period)
        elif report == "conversion-funnel":
            payload = await conversion_funnel(conn, org, period)
        elif report == "activity-performance":
            payload = await activity_performance(conn, org, period)
        elif report == "quota-leaderboard":
            payload = await quota_leaderboard(conn, org, period)
        else:
            payload = await target_pace(conn, org, period)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    csv_text = report_to_csv(report, payload)
    safe_name = report.replace("-", "_")
    return StreamingResponse(
        iter([csv_text]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.csv"'},
    )
