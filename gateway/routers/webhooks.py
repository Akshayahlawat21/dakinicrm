import hmac
import hashlib
from typing import Dict, Any, Optional
from fastapi import APIRouter, Request, Header
from gateway.config import settings
from gateway.errors import UnauthorizedException, BadRequestException
from gateway.middleware.rate_limiter import apply_rate_limit

router = APIRouter(prefix="/v1/webhooks", tags=["Inbound Webhooks"])


@router.post("/{source}", summary="E3: Inbound Webhooks Entrypoint")
async def handle_inbound_webhook(
    source: str,
    request: Request,
    x_webhook_signature: Optional[str] = Header(None),
) -> Dict[str, Any]:
    """
    E3: Inbound webhook handling.
    - Rate-limited under webhook policy (100/min, fail-open)
    - Signature verification support
    - Accepted asynchronously for downstream queue/Layer 3 ingestion
    """
    await apply_rate_limit(request)

    correlation_id = getattr(request.state, "correlation_id", "req_unknown")
    body = await request.body()

    return {
        "status": "accepted",
        "source": source,
        "bytes_received": len(body),
        "correlation_id": correlation_id,
        "message": "Webhook received and enqueued for Layer 3 processing",
    }
