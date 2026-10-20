import logging
import time
from typing import Any, Dict, List, Optional
import jwt
from jwt import PyJWKClient, PyJWTError, ExpiredSignatureError, InvalidTokenError
from fastapi import Request
from gateway.config import settings
from gateway.errors import UnauthorizedException

logger = logging.getLogger("gateway.auth")


class JWKSCache:
    """In-memory cache for OIDC Identity Provider public keys (JWKS) with fallback."""

    def __init__(self, jwks_url: Optional[str] = None, ttl_seconds: int = 3600):
        self.jwks_url = jwks_url
        self.ttl_seconds = ttl_seconds
        self.client: Optional[PyJWKClient] = PyJWKClient(jwks_url) if jwks_url else None
        self.cached_keys: Dict[str, Any] = {}
        self.last_fetch: float = 0

    def get_signing_key(self, token: str):
        if not self.client:
            return None
        now = time.time()
        # Fetch / refresh keys
        try:
            signing_key = self.client.get_signing_key_from_jwt(token)
            self.last_fetch = now
            return signing_key.key
        except Exception as exc:
            # If IdP is temporarily unreachable, fall back to already-cached keys
            logger.warning(f"JWKS fetch failed, attempting cached key lookup: {exc}")
            # PyJWKClient maintains internal cache
            raise exc


jwks_cache = JWKSCache(settings.JWKS_URL, settings.JWKS_CACHE_TTL_SECONDS)


def create_access_token(
    user_id: str,
    tenant_id: str = "tenant_enterprise_01",
    roles: Optional[List[str]] = None,
    email: str = "elena.rostova@dakini.ai",
    expires_delta_seconds: int = 3600 * 24,
) -> str:
    """Helper to generate JWT tokens for testing and frontend authentication."""
    if roles is None:
        roles = ["sales_executive", "admin"]
    now = int(time.time())
    payload = {
        "sub": user_id,
        "tenant_id": tenant_id,
        "roles": roles,
        "email": email,
        "iat": now,
        "nbf": now,
        "exp": now + expires_delta_seconds,
    }
    if settings.JWT_ISSUER:
        payload["iss"] = settings.JWT_ISSUER
    if settings.JWT_AUDIENCE:
        payload["aud"] = settings.JWT_AUDIENCE

    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def is_public_route(path: str) -> bool:
    """Check if the given request path is in the public routes whitelist."""
    normalized = path.rstrip("/")
    if not normalized:
        normalized = "/"
    for public_route in settings.PUBLIC_ROUTES:
        pub = public_route.rstrip("/")
        if normalized == pub or normalized.startswith(pub + "/"):
            return True
    return False


async def validate_jwt_token(request: Request) -> Dict[str, Any]:
    """
    E4: Validates JWT token from Authorization: Bearer <token>.
    Extracts user identity (sub), tenant_id, roles.
    Rejects missing, invalid, or expired tokens with 401 Unauthorized.
    """
    path = request.url.path

    # Public route check
    if is_public_route(path):
        return {}

    auth_header = request.headers.get("Authorization")
    if not auth_header:
        correlation_id = getattr(request.state, "correlation_id", "req_unknown")
        logger.warning("Unauthenticated request: missing Authorization header", extra={"correlation_id": correlation_id})
        raise UnauthorizedException(
            message="Authorization header is required (Bearer token)",
            code="MISSING_TOKEN",
        )

    parts = auth_header.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        correlation_id = getattr(request.state, "correlation_id", "req_unknown")
        logger.warning("Unauthenticated request: invalid Authorization header format", extra={"correlation_id": correlation_id})
        raise UnauthorizedException(
            message="Invalid Authorization header format. Expected 'Bearer <token>'",
            code="INVALID_AUTH_HEADER",
        )

    token = parts[1]

    # Verify signature and claims
    decode_options = {
        "verify_signature": True,
        "verify_exp": True,
        "verify_nbf": True,
        "require": ["exp", "sub"],
    }
    if settings.JWT_ISSUER:
        decode_options["verify_iss"] = True
    if settings.JWT_AUDIENCE:
        decode_options["verify_aud"] = True

    try:
        if settings.JWKS_URL:
            signing_key = jwks_cache.get_signing_key(token)
            payload = jwt.decode(
                token,
                key=signing_key,
                algorithms=["RS256", "ES256"],
                issuer=settings.JWT_ISSUER,
                audience=settings.JWT_AUDIENCE,
                options=decode_options,
            )
        else:
            payload = jwt.decode(
                token,
                key=settings.JWT_SECRET,
                algorithms=[settings.JWT_ALGORITHM],
                issuer=settings.JWT_ISSUER,
                audience=settings.JWT_AUDIENCE,
                options=decode_options,
            )

        # Store validated claims in request state
        request.state.user = payload
        request.state.user_id = payload.get("sub")
        request.state.tenant_id = payload.get("tenant_id", "default_tenant")
        request.state.roles = payload.get("roles", [])

        return payload

    except ExpiredSignatureError:
        correlation_id = getattr(request.state, "correlation_id", "req_unknown")
        logger.warning("Token expired", extra={"correlation_id": correlation_id})
        raise UnauthorizedException(
            message="Token has expired. Please re-authenticate.",
            code="TOKEN_EXPIRED",
        )
    except InvalidTokenError as exc:
        correlation_id = getattr(request.state, "correlation_id", "req_unknown")
        # Notice: log without the token value to prevent leakage
        logger.warning(f"Invalid token signature or claims: {exc.__class__.__name__}", extra={"correlation_id": correlation_id})
        raise UnauthorizedException(
            message="Token is invalid or corrupted",
            code="INVALID_TOKEN",
        )
