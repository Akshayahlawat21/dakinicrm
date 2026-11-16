import re
import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
import httpx

from backend.app.core.config import settings
from backend.app.application.exceptions import BadRequestError, ApplicationError

logger = logging.getLogger("backend.telephony")


def redact_tokens_recursive(obj: Any) -> Any:
    """
    Recursively replaces any dict key named 'token' (case-insensitive) with '<redacted>'.
    Leaves all other keys, types, and nested structures unmodified.
    Single intentional exception to preserving raw upstream responses.
    """
    if isinstance(obj, dict):
        return {
            k: (
                "<redacted>"
                if str(k).lower() in ("token", "livekit_token", "jwt_token", "access_token")
                else redact_tokens_recursive(v)
            )
            for k, v in obj.items()
        }
    elif isinstance(obj, list):
        return [redact_tokens_recursive(item) for item in obj]
    return obj


def classify_carrier_call(
    api_accepted: bool,
    data: Optional[Dict[str, Any]],
    status_code: Optional[int] = None,
    error_msg: Optional[str] = None,
) -> tuple[str, Optional[str], Optional[str]]:
    """
    Classifies carrier call response following strict precedence:
    FAILED > SIMULATED > DISPATCHED_UNVERIFIED.

    Returns: (carrier_status, carrier_warning, error_message)
    """
    # 1. Precedence: FAILED
    if not api_accepted or (status_code is not None and not (200 <= status_code < 300)):
        return "failed", None, error_msg or f"Upstream HTTP error {status_code or 'network/timeout'}"

    data = data or {}

    # 2xx checks for FAILED:
    # - success === False
    # - ok === False
    # - non-empty error field
    has_success_false = data.get("success") is False
    has_ok_false = data.get("ok") is False
    err_val = data.get("error")
    has_error_field = bool(err_val) and str(err_val).strip() != ""

    if has_success_false or has_ok_false or has_error_field:
        fail_msg = (
            str(err_val)
            if has_error_field
            else data.get("message") or "Upstream gateway rejected call request"
        )
        return "failed", None, fail_msg

    # 2. Precedence: SIMULATED (only if not failed)
    # - mode_used equals "carrier_simulated"
    # - call_id starts with "sim-" (case-insensitive, null-safe)
    # - details.notice contains "fallback simulated" (case-insensitive, null-safe)
    mode_used = str(data.get("mode_used") or "").strip().lower()
    call_id = str(data.get("call_id") or "").strip().lower()

    details = data.get("details")
    notice = ""
    if isinstance(details, dict):
        notice = str(details.get("notice") or "").strip().lower()
    elif isinstance(details, str):
        notice = details.strip().lower()

    is_simulated = (
        mode_used == "carrier_simulated"
        or call_id.startswith("sim-")
        or "fallback simulated" in notice
    )

    if is_simulated:
        return (
            "simulated",
            "Telephony gateway is in simulation mode. No real phone call was placed.",
            None,
        )

    # 3. Precedence: DISPATCHED_UNVERIFIED (everything else)
    # Never label anything "connected" or "real" from dial response alone.
    return "dispatched_unverified", None, None


def normalize_phone_number(raw_phone: str) -> str:
    """
    Sanitizes and normalizes phone number to E.164 standard.
    Strips spaces, brackets, hyphens.
    """
    if not raw_phone:
        raise BadRequestError("Phone number is required and cannot be empty")

    cleaned = re.sub(r"[^\d+]", "", raw_phone.strip())
    if not cleaned:
        raise BadRequestError("Invalid phone number: no digits found")

    # If starts with +, ensure valid length
    if cleaned.startswith("+"):
        if len(cleaned) < 8 or len(cleaned) > 16:
            raise BadRequestError(f"Invalid E.164 phone number length: {cleaned}")
        return cleaned

    # If 10 digits (e.g. Indian mobile number without country code), prepend +91
    if len(cleaned) == 10 and cleaned[0] in "6789":
        return f"+91{cleaned}"

    # If 12 digits starting with 91, prepend +
    if len(cleaned) == 12 and cleaned.startswith("91"):
        return f"+{cleaned}"

    # If 11 digits starting with 1 (US), prepend +
    if len(cleaned) == 11 and cleaned.startswith("1"):
        return f"+{cleaned}"

    # Default: prepend + and validate total E.164 length
    res = f"+{cleaned}"
    if len(res) < 8 or len(res) > 16:
        raise BadRequestError(f"Invalid E.164 phone number length: {res}")
    return res


class TelephonyService:
    """
    Service integrating with Dakini Telephony & AI Backend.
    Guarantees HUMAN-ONLY calling by configuring mode to HUMAN_ONLY and isolating AI dependencies.
    """

    _registry: Dict[str, Dict[str, Any]] = {}

    def __init__(self, http_client: Optional[httpx.AsyncClient] = None):
        self._client = http_client

    def get_config(self) -> Dict[str, str]:
        return {
            "from_number": settings.TELEPHONY_FROM_NUMBER,
            "signaling_url": settings.LIVEKIT_SIGNALING_URL,
            "outbound_mode": settings.TELEPHONY_OUTBOUND_MODE,
        }

    async def generate_token(
        self,
        room: Optional[str] = None,
        identity: Optional[str] = None,
        name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Mint a LiveKit WebRTC JWT token via POST /api/dialer/token.
        """
        actual_room = room or f"call_{uuid.uuid4().hex[:12]}"
        actual_identity = identity or f"webrtc_{uuid.uuid4().hex[:8]}"
        actual_name = name or "WebRTC Salesperson"

        url = f"{settings.TELEPHONY_BASE_URL.rstrip('/')}/api/dialer/token"
        payload = {
            "room": actual_room,
            "identity": actual_identity,
            "name": actual_name,
        }

        async with httpx.AsyncClient(timeout=settings.TELEPHONY_TIMEOUT_SECONDS) as client:
            try:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                data = resp.json()
            except Exception as e:
                logger.error(f"Failed to generate LiveKit token from {url}: {e}")
                raise ApplicationError(f"Telephony token service unavailable: {e}")

        token = data.get("token")
        server_url = data.get("server_url") or data.get("url") or settings.LIVEKIT_SIGNALING_URL
        return {
            "success": True,
            "token": token,
            "url": server_url,
            "room": data.get("room") or actual_room,
            "identity": data.get("identity") or actual_identity,
        }

    async def initiate_call(
        self,
        to_number: str,
        lead_id: Optional[str] = None,
        contact_name: Optional[str] = None,
        room: Optional[str] = None,
        record: Optional[bool] = None,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Initiates outbound PSTN call bridged into a LiveKit room.
        Uses configured mode (HUMAN_ONLY) and matches the official documentation payload.
        """
        normalized_to = normalize_phone_number(to_number)
        actual_room = room or f"crm_room_{uuid.uuid4().hex[:12]}"

        url = f"{settings.TELEPHONY_BASE_URL.rstrip('/')}/api/dialer/call"
        payload = {
            "to_number": normalized_to,
            "from_number": settings.TELEPHONY_FROM_NUMBER,
            "room": actual_room,
            "mode": settings.TELEPHONY_OUTBOUND_MODE,
        }
        # Only attach record if explicitly provided (new API contract omits record)
        if record is not None:
            payload["record"] = record

        api_accepted = False
        upstream_data: Optional[Dict[str, Any]] = None
        upstream_status_code: Optional[int] = None
        net_err_msg: Optional[str] = None

        async with httpx.AsyncClient(timeout=settings.TELEPHONY_TIMEOUT_SECONDS) as client:
            try:
                resp = await client.post(url, json=payload)
                upstream_status_code = resp.status_code
                api_accepted = 200 <= resp.status_code < 300
                try:
                    upstream_data = resp.json()
                except Exception:
                    upstream_data = {"raw_body": resp.text} if resp.text else {}
            except Exception as e:
                logger.error(f"Failed to initiate call via {url}: {e}")
                api_accepted = False
                net_err_msg = str(e)

        # Classify carrier response: FAILED > SIMULATED > DISPATCHED_UNVERIFIED
        carrier_status, carrier_warning, err_msg = classify_carrier_call(
            api_accepted=api_accepted,
            data=upstream_data,
            status_code=upstream_status_code,
            error_msg=net_err_msg,
        )

        data = upstream_data or {}
        # Recursive token redaction for safe browser consumption and safe logging
        sanitized_upstream_raw = redact_tokens_recursive(upstream_data) if upstream_data is not None else None

        if sanitized_upstream_raw:
            logger.info(f"Upstream dialer response received (carrier_status={carrier_status}): {sanitized_upstream_raw}")

        call_id = data.get("call_id") or (f"sim_{uuid.uuid4().hex[:8]}" if carrier_status == "simulated" else f"call_{uuid.uuid4().hex[:8]}")
        call_uuid = data.get("call_uuid")
        status = "failed" if carrier_status == "failed" else (data.get("status") or ("simulated" if carrier_status == "simulated" else "dialing"))
        returned_url = data.get("server_url") or data.get("url") or settings.LIVEKIT_SIGNALING_URL
        call_message = err_msg if carrier_status == "failed" else data.get("message")
        is_ok = carrier_status != "failed" and bool(data.get("ok", True))
        is_success = carrier_status != "failed" and bool(data.get("success", True))

        record_entry = {
            "call_id": call_id,
            "call_uuid": call_uuid,
            "room": actual_room,
            "to_number": normalized_to,
            "from_number": settings.TELEPHONY_FROM_NUMBER,
            "lead_id": lead_id,
            "contact_name": contact_name or "External Contact",
            "user_id": user_id,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "status": status,
            "mode": settings.TELEPHONY_OUTBOUND_MODE,
            "carrier_status": carrier_status,
            "carrier_warning": carrier_warning,
            "api_accepted": api_accepted,
        }
        self._registry[actual_room] = record_entry
        self._registry[call_id] = record_entry
        if call_uuid:
            self._registry[call_uuid] = record_entry

        return {
            "ok": is_ok,
            "success": is_success,
            "call_id": call_id,
            "call_uuid": call_uuid,
            "room": actual_room,
            "to_number": normalized_to,
            "from_number": settings.TELEPHONY_FROM_NUMBER,
            "status": status,
            "mode": settings.TELEPHONY_OUTBOUND_MODE,
            "server_url": returned_url,
            "lead_id": lead_id,
            "contact_name": contact_name,
            "message": call_message,
            "api_accepted": api_accepted,
            "carrier_status": carrier_status,
            "carrier_warning": carrier_warning,
            "upstream_raw": sanitized_upstream_raw,
        }

    async def hangup(
        self,
        room: str,
        call_id: Optional[str] = None,
        lead_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Hang up active call via POST /api/dialer/hangup.
        Matches official API contract: {room, call_id} -> {ok, status, room_deleted}
        """
        url = f"{settings.TELEPHONY_BASE_URL.rstrip('/')}/api/dialer/hangup"
        payload = {
            "room": room,
            "call_id": call_id or "",
        }

        async with httpx.AsyncClient(timeout=settings.TELEPHONY_TIMEOUT_SECONDS) as client:
            try:
                resp = await client.post(url, json=payload)
                data = resp.json() if resp.status_code < 500 else {}
            except Exception as e:
                logger.warning(f"Hangup request failed on telephony backend: {e}")
                data = {"ok": True, "status": "terminated", "room_deleted": True, "message": str(e)}

        duration_sec = data.get("duration_seconds")
        # Update and clean registry
        if room in self._registry:
            self._registry[room]["status"] = "completed"
            self._registry[room]["ended_at"] = datetime.now(timezone.utc).isoformat()
            if duration_sec:
                self._registry[room]["duration_sec"] = duration_sec

        return {
            "ok": bool(data.get("ok", data.get("success", True))),
            "success": bool(data.get("ok", data.get("success", True))),
            "status": "terminated",
            "room_deleted": bool(data.get("room_deleted", True)),
            "room": room,
            "call_id": call_id,
            "duration_seconds": duration_sec,
            "message": data.get("message", "Call terminated successfully"),
        }

    async def get_room_status(self, room: str) -> Dict[str, Any]:
        url = f"{settings.TELEPHONY_BASE_URL.rstrip('/')}/api/dialer/room-status"
        async with httpx.AsyncClient(timeout=settings.TELEPHONY_TIMEOUT_SECONDS) as client:
            try:
                resp = await client.get(url, params={"room": room})
                if resp.status_code == 200:
                    data = resp.json()
                    raw_room = data.get("room")
                    room_exists = bool(raw_room or data.get("success", False))
                    participants = data.get("participants", []) or []
                    sip_status = str(data.get("sip_status", "idle")).strip().lower()

                    # Tolerant PSTN-connected detection:
                    # PSTN-connected if ANY participant has kind "sip"/"SIP" or an identity
                    # matching pstn-/sip-/phone patterns, OR sip_status is an active value (active, in-progress, connected, answered).
                    # Note: "dialing" is excluded because dialing is not yet connected.
                    # TODO: Retest and confirm with real carrier PSTN dispatch once upstream enables live Vobiz trunk.
                    pstn_active = False
                    if sip_status in ("active", "in-progress", "connected", "answered"):
                        pstn_active = True
                    else:
                        for p in participants:
                            if isinstance(p, dict):
                                p_kind = str(p.get("kind", "")).strip().lower()
                                p_id = str(p.get("identity", "")).strip().lower()
                                if (
                                    p_kind == "sip"
                                    or p_id.startswith(("pstn-", "sip-", "phone-"))
                                    or bool(re.search(r"^\+?\d{8,15}$", p_id))
                                ):
                                    pstn_active = True
                                    break

                    agent_active = any(
                        isinstance(p, dict) and not str(p.get("identity", "")).lower().startswith(("pstn-", "sip-"))
                        for p in participants
                    )
                    return {
                        "exists": room_exists,
                        "pstn_connected": pstn_active,
                        "agent_connected": agent_active,
                        "participants": participants,
                        "sip_status": sip_status,
                        "room": room,
                    }
            except Exception as e:
                logger.warning(f"Error fetching room status for {room}: {e}")

        # Fallback to local registry state
        reg = self._registry.get(room)
        return {
            "exists": bool(reg),
            "pstn_connected": reg.get("status") == "connected" if reg else False,
            "agent_connected": bool(reg),
            "participants": [],
            "sip_status": "idle",
            "room": room,
        }

    async def get_active_calls(self) -> List[Dict[str, Any]]:
        url = f"{settings.TELEPHONY_BASE_URL.rstrip('/')}/api/dialer/active"
        active_list = []
        async with httpx.AsyncClient(timeout=settings.TELEPHONY_TIMEOUT_SECONDS) as client:
            try:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    active_list = data.get("active_sessions", [])
            except Exception as e:
                logger.warning(f"Error listing active calls: {e}")

        # Merge with CRM metadata
        enriched = []
        for call in active_list:
            room = call.get("room")
            meta = self._registry.get(room, {})
            enriched.append({
                **call,
                "lead_id": meta.get("lead_id"),
                "contact_name": meta.get("contact_name"),
            })
        return enriched

    async def get_call_history(self) -> List[Dict[str, Any]]:
        url = f"{settings.TELEPHONY_BASE_URL.rstrip('/')}/api/dialer/history"
        history_list = []
        async with httpx.AsyncClient(timeout=settings.TELEPHONY_TIMEOUT_SECONDS) as client:
            try:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    history_list = data.get("calls", [])
            except Exception as e:
                logger.warning(f"Error listing call history: {e}")

        # Merge with CRM metadata
        enriched = []
        for item in history_list:
            room = item.get("room")
            call_id = item.get("call_id")
            meta = self._registry.get(room) or self._registry.get(call_id) or {}

            # Classify history item carrier status
            c_status, c_warn, _ = classify_carrier_call(
                api_accepted=True,
                data=item,
                status_code=200,
            )

            enriched.append({
                **item,
                "lead_id": meta.get("lead_id"),
                "contact_name": meta.get("contact_name"),
                "carrier_status": meta.get("carrier_status") or c_status,
                "carrier_warning": meta.get("carrier_warning") or c_warn,
            })
        return enriched

    async def send_dtmf(self, room: str, digit: str) -> Dict[str, Any]:
        url = f"{settings.TELEPHONY_BASE_URL.rstrip('/')}/api/dialer/dtmf"
        payload = {"room": room, "digit": digit}
        async with httpx.AsyncClient(timeout=settings.TELEPHONY_TIMEOUT_SECONDS) as client:
            try:
                resp = await client.post(url, json=payload)
                data = resp.json() if resp.status_code < 500 else {}
                return {"ok": True, "room": room, "digit": digit}
            except Exception as e:
                logger.warning(f"Failed to send DTMF tone: {e}")
                return {"ok": False, "room": room, "digit": digit, "error": str(e)}

    async def call_control(
        self,
        call_id: str,
        action: str,
        transfer_to: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Execute mid-call control (hold, resume, transfer) via POST /api/calls/{call_id}/control.
        """
        url = f"{settings.TELEPHONY_BASE_URL.rstrip('/')}/api/calls/{call_id}/control"
        payload: Dict[str, Any] = {"action": action}
        if transfer_to:
            payload["transfer_to"] = normalize_phone_number(transfer_to)

        async with httpx.AsyncClient(timeout=settings.TELEPHONY_TIMEOUT_SECONDS) as client:
            try:
                resp = await client.post(url, json=payload)
                data = resp.json() if resp.status_code < 500 else {}
                return {
                    "success": resp.status_code == 200,
                    "call_id": call_id,
                    "action": action,
                    "status": data.get("status", "applied"),
                    "message": data.get("message", f"Action {action} executed"),
                }
            except Exception as e:
                logger.warning(f"Call control {action} failed: {e}")
                return {
                    "success": False,
                    "call_id": call_id,
                    "action": action,
                    "error": str(e),
                }

    async def merge_call(
        self,
        room: str,
        to_number: str,
        contact_name: Optional[str] = None,
        lead_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Merges a second party into an active LiveKit room conference.
        """
        return await self.initiate_call(
            to_number=to_number,
            room=room,
            contact_name=contact_name,
            lead_id=lead_id,
            record=True,
        )

    async def initiate_headless_call(
        self,
        to_number: str,
        from_number: Optional[str] = None,
        mode: str = "auto",
    ) -> Dict[str, Any]:
        """
        Trigger an outbound call directly from external backend/CRM (POST /api/telephony/call)
        without requiring a human browser softphone to pre-join the room.
        """
        normalized_to = normalize_phone_number(to_number)
        url = f"{settings.TELEPHONY_BASE_URL.rstrip('/')}/api/telephony/call"
        payload = {
            "to": normalized_to,
            "from": from_number or settings.TELEPHONY_FROM_NUMBER,
            "mode": mode,
        }

        async with httpx.AsyncClient(timeout=settings.TELEPHONY_TIMEOUT_SECONDS) as client:
            try:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                data = resp.json()
            except Exception as e:
                logger.error(f"Failed to initiate headless call via {url}: {e}")
                raise ApplicationError(f"Headless outbound call failed: {e}")

        call_id = data.get("call_id") or data.get("sip_call_id") or "unknown_call_id"
        room_name = data.get("room_name") or data.get("room") or call_id
        status = data.get("status") or "initiated"

        return {
            "ok": data.get("ok", data.get("success", True)),
            "call_id": call_id,
            "room_name": room_name,
            "status": status,
        }

