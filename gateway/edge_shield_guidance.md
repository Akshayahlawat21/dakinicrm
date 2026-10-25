# Layer 2 — Edge Shield (E1) & TLS / Reverse-Proxy (E2) Integration Guidance

## 1. Architecture Overview

As specified in the **Dakini CRM Low-Level Design (LLD)**, Layer 2 acts as the **front door** of the system. It decides whether an incoming request is *deliverable and safe* before it reaches Layer 3 (Application API).

```text
+-----------------------------------------------------------------------------------+
|  Browser / Mobile Client (HTTPS, Authorization: Bearer <jwt>)                    |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+───────────────────────────────────────────────────────────────────────────────────+
|  E1: Edge Shield (Cloudflare / AWS CloudFront / Fastly)                           |
|  - Anycast DNS resolution & DDoS mitigation                                       |
|  - Edge WAF (OWASP Core Rule Set, bot mitigation on login)                       |
|  - Static asset CDN caching (React bundle, fonts, images)                        |
|  - Blocks malicious traffic before reaching origin                               |
+───────────────────────────────────────────────────────────────────────────────────+
                                         │  (Encrypted Transit / mTLS)
                                         ▼
+───────────────────────────────────────────────────────────────────────────────────+
|  E2: Reverse-Proxy / TLS Termination & Load Balancer                              |
|  - AWS Application Load Balancer (ALB) / Nginx / Envoy / Caddy                    |
|  - TLS 1.3 termination & automated certificate management (ACM / Let's Encrypt)  |
|  - Injects `X-Forwarded-For`, `X-Forwarded-Proto`, `CF-Connecting-IP`             |
|  - Health checks `/health` and distributes traffic across gateway instances      |
+───────────────────────────────────────────────────────────────────────────────────+
                                         │
                                         ▼
+───────────────────────────────────────────────────────────────────────────────────+
|  Dakini Python API Gateway (FastAPI)                                              |
|  - E1: Direct origin bypass check (EDGE_SHIELD_ENABLED / X-Edge-Secret)          |
|  - E7: Correlation ID generation & sanitized access logging                       |
|  - E6: Header / body size limits, allowed methods, Content-Type & CORS            |
|  - E3: Versioned routing (/v1) & OpenAPI contracts                                |
|  - E4: JWT signature verification (HMAC / OIDC JWKS caching)                      |
|  - E5: Distributed rate limiting (sliding-window, in-memory / Redis)              |
|  - E8: Normalized JSON error envelopes                                            |
+───────────────────────────────────────────────────────────────────────────────────+
                                         │
                                         ▼
+───────────────────────────────────────────────────────────────────────────────────+
|  Layer 3: Application API (FastAPI / Django - Domain Services)                    |
|  - Lead scoring, deals pipeline, agent orchestration, RBAC & business logic       |
+───────────────────────────────────────────────────────────────────────────────────+
```

> **Important Architectural Boundary:**  
> Python application middleware alone cannot substitute for Anycast DNS, multi-terabit DDoS absorption, or network-level TLS termination. The Python gateway is designed to integrate seamlessly with standard edge platforms (Cloudflare, AWS CloudFront, Nginx).

---

## 2. E1: Edge Shield (DNS, CDN, WAF, DDoS) Guidance

### 2.1 CDN Caching Policies
- **Static Assets (React Frontend):**
  - Cache HTML with `Cache-Control: public, max-age=0, must-revalidate` (for instant zero-downtime updates).
  - Cache hashed JS/CSS assets (`dist/assets/*.js`) with `Cache-Control: public, max-age=31536000, immutable`.
- **API Traffic (`/v1/*`):**
  - **Never cache authenticated responses.** The Gateway automatically injects:
    ```http
    Cache-Control: no-store, no-cache, must-revalidate, private
    Pragma: no-cache
    Expires: 0
    ```
  - In Cloudflare, create a **Cache Rule**:
    - Match: `URI Path starts with "/v1/"`
    - Action: `Bypass Cache`

### 2.2 Edge WAF Configuration (Cloudflare / AWS WAF)
- **Managed Rule Sets:**
  - Enable **Cloudflare Managed Ruleset** / **AWS Common Rule Set (CRS)** to block SQL injection, cross-site scripting (XSS), and remote code execution (RCE).
  - **Phased Rollout:** Deploy new WAF rules in **Log-only / Simulate mode** for 72 hours. Review false positives with the sales team before switching to **Block mode**.
- **Bot Mitigation on Auth Routes:**
  - Route: `/v1/auth/login` and `/v1/auth/token`
  - Action: Turn on Cloudflare Turnstile / Bot Fight Mode to prevent brute-force credential stuffing.

### 2.3 Direct Origin Bypass Protection
To ensure attackers cannot discover and bypass the edge shield to reach the origin IP directly:
1. **Cloudflare Authenticated Origin Pulls (AOP):**
   - Origin server (Nginx/ALB) validates Cloudflare's client SSL certificate.
2. **Shared Edge Token (Implemented in Gateway):**
   - Cloudflare injects a secret transform header: `X-Edge-Secret: <EDGE_SHIELD_SECRET>`.
   - Set `EDGE_SHIELD_ENABLED=true` in `gateway/.env`.
   - If an attacker sends direct requests without this valid header, the Gateway returns `403 Forbidden` (`EDGE_SHIELD_REQUIRED`).

---

## 3. E2: Reverse-Proxy, TLS Termination & Health Checks

### 3.1 TLS Termination
- **Protocols:** Modern TLS 1.3 and TLS 1.2 (PFS ciphers only, e.g. `ECDHE-ECDSA-AES128-GCM-SHA256`).
- **HSTS:** The Gateway injects `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`.
- **Certificates:** Automated renewal via AWS ACM or Let's Encrypt Certbot.

### 3.2 Health Check Endpoint
- The Gateway exposes both:
  - `GET /health` (Root health check for AWS ALB / Nginx / Kubernetes liveness)
  - `GET /v1/health` (Versioned health check for API monitoring)
- **Response Format:**
  ```json
  {
    "status": "healthy",
    "service": "dakini-layer2-gateway",
    "version": "1.0.0",
    "environment": "production",
    "timestamp": 1729450000,
    "correlation_id": "req_84e1b782c5a",
    "upstream": {
      "url": "http://upstream-layer3:8000",
      "status": "healthy"
    },
    "edge_shield": {
      "enabled": true
    },
    "rate_limiting": {
      "enabled": true,
      "backend": "redis"
    }
  }
  ```
- **Load Balancer Configuration:**
  - Target Path: `/health`
  - Healthy Threshold: 2
  - Interval: 10s
  - Timeout: 3s

### 3.3 Sample Nginx Reverse-Proxy Configuration
```nginx
upstream dakini_gateway {
    server 127.0.0.1:8080 max_fails=3 fail_timeout=10s;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name api.dakini.ai;

    ssl_certificate /etc/letsencrypt/live/api.dakini.ai/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.dakini.ai/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 10M;

    location / {
        proxy_pass http://dakini_gateway;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        
        # E2 Forwarded Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Pass Edge Secret if Nginx is downstream of Cloudflare
        # proxy_set_header X-Edge-Secret "production-secret-token";
    }

    location /health {
        proxy_pass http://dakini_gateway/health;
        access_log off;
    }
}
```

---

## 4. E5: Rate Limiting Architecture — In-Memory vs Shared Redis Mode

Layer 2 Gateway implements configurable sliding-window rate limiting to protect system availability, prevent brute-force attacks, and stop noisy-neighbor tenant starvation.

### 4.1 Mode Comparison

| Feature | Local In-Memory Mode (`REDIS_URL` unset) | Shared Redis Mode (`REDIS_URL` configured) |
| :--- | :--- | :--- |
| **Storage Engine** | Process-local `collections.deque` timestamps | Centralized Redis/Valkey sorted sets (`ZADD`, `ZREMRANGEBYSCORE`, `ZCARD`) |
| **Deployment Suitability** | Single instance, local development, CI automated testing | Multi-instance load-balanced production clusters |
| **Process Sharing** | Isolated to single process; limits apply per worker | Shared uniformly across all gateway worker processes and instances |
| **State Lifespan** | Ephemeral (resets on process restart or reload) | Persistent across gateway restarts, bounded by TTL (`window + 5s`) |
| **Network Overhead** | 0 ms (pure memory lookup) | Sub-millisecond Redis round-trip pipelined into one batch |
| **Failure Handling** | Never fails externally | Adheres to strict **fail-open** vs **fail-closed** policy per endpoint class |

### 4.2 Fail-Open vs Fail-Closed Policy

When using shared Redis mode, if Redis experiences temporary downtime or connection drop:

1. **Fail-Closed Endpoints (`fail_closed = True`):**
   - **Login (`/v1/auth/login`)**: Fails closed (returns `503 Service Unavailable` or `429`). Protects against credential-stuffing and brute-force attacks during store outages.
   - **AI Assistant (`/v1/agent`)**: Fails closed to prevent runaway LLM inference cost spikes.
   - **Bulk Export / Import (`/export`, `/import`)**: Fails closed to safeguard database I/O bandwidth.
2. **Fail-Open Endpoints (`fail_closed = False`):**
   - **Standard Reads (`GET`) & Writes (`POST/PUT/PATCH`)**: Fails open with a warning log. Prevents a cache/store failure from taking down normal sales reps' CRM workflows.
   - **Webhooks (`/v1/webhooks/*`)**: Fails open to ensure webhook ingestion is not permanently dropped.

### 4.3 Policy Limits Matrix

| Endpoint Class | Scope Key | Default Limit | Window | Store Failure Action | Exceeded Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Login / Auth** | `IP` (or account) | 10 requests | 60 sec | **Fail-closed** | `429` + `Retry-After` header |
| **Normal Reads (GET)** | Authenticated `User ID` / `IP` | 300 requests | 60 sec | **Fail-open** | `429` |
| **Writes (POST/PUT/PATCH)** | Authenticated `User ID` / `IP` | 60 requests | 60 sec | **Fail-open** | `429` |
| **Bulk Import / Export** | `Tenant ID` + `User ID` | 5 requests | 3600 sec | **Fail-closed** | `429` (audit logged) |
| **AI Assistant Calls** | Authenticated `User ID` | 20 requests | 60 sec | **Fail-closed** | `429` |
| **Inbound Webhooks** | Integration source / `IP` | 100 requests | 60 sec | **Fail-open** | `429` |
| **Tenant Fair-Share** | `Tenant ID` | 3000 requests | 60 sec | **Fail-open** | `429` (affects tenant only) |
