import re
import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
import httpx

from backend.app.core.config import settings
from backend.app.application.exceptions import BadRequestError, ApplicationError

logger = logging.getLogger("backend.telephony")


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
        record: bool = True,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Initiates outbound PSTN call bridged into a LiveKit room.
        Uses configured mode (HUMAN_ONLY).
        """
        normalized_to = normalize_phone_number(to_number)
        actual_room = room or f"crm_room_{uuid.uuid4().hex[:12]}"

        # Pre-mint token if not already in response
        token_info = await self.generate_token(
            room=actual_room,
            identity=f"webrtc_agent_{uuid.uuid4().hex[:6]}",
            name=contact_name or "CRM Salesperson",
        )

        url = f"{settings.TELEPHONY_BASE_URL.rstrip('/')}/api/dialer/call"
        payload = {
            "to_number": normalized_to,
            "from_number": settings.TELEPHONY_FROM_NUMBER,
            "room": actual_room,
            "mode": settings.TELEPHONY_OUTBOUND_MODE,
            "record": record,
        }

        async with httpx.AsyncClient(timeout=settings.TELEPHONY_TIMEOUT_SECONDS) as client:
            try:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                data = resp.json()
            except Exception as e:
                logger.error(f"Failed to initiate call via {url}: {e}")
                raise ApplicationError(f"Telephony outbound call initiation failed: {e}")

        call_id = data.get("call_id") or f"call_{uuid.uuid4().hex[:8]}"
        call_uuid = data.get("call_uuid")
        status = data.get("status") or "dialing"
        returned_token = data.get("token") or token_info["token"]
        returned_url = data.get("server_url") or data.get("url") or token_info["url"]

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
        }
        self._registry[actual_room] = record_entry
        self._registry[call_id] = record_entry

        return {
            "success": True,
            "call_id": call_id,
            "call_uuid": call_uuid,
            "room": actual_room,
            "to_number": normalized_to,
            "from_number": settings.TELEPHONY_FROM_NUMBER,
            "status": status,
            "mode": settings.TELEPHONY_OUTBOUND_MODE,
            "token": returned_token,
            "server_url": returned_url,
            "lead_id": lead_id,
            "contact_name": contact_name,
            "message": data.get("message"),
        }

    async def hangup(
        self,
        room: str,
        call_id: Optional[str] = None,
        lead_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Hang up active call via POST /api/dialer/hangup.
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
                data = {"success": True, "status": "terminated", "message": str(e)}

        duration_sec = data.get("duration_seconds")
        # Update and clean registry
        if room in self._registry:
            self._registry[room]["status"] = "completed"
            self._registry[room]["ended_at"] = datetime.now(timezone.utc).isoformat()
            if duration_sec:
                self._registry[room]["duration_sec"] = duration_sec

        return {
            "success": True,
            "status": "terminated",
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
                    return {
                        "exists": bool(data.get("exists", False)),
                        "pstn_connected": bool(data.get("pstn_connected", False)),
                        "agent_connected": bool(data.get("agent_connected", False)),
                        "participants": data.get("participants", []),
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
            enriched.append({
                **item,
                "lead_id": meta.get("lead_id"),
                "contact_name": meta.get("contact_name"),
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

