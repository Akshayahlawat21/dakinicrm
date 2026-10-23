#!/usr/bin/env python3
"""Apply the optional Layer 9 analytics proxy to a Dakini CRM repository checkout.

Run from the repository root:
    python gateway-patch/apply_gateway_integration.py

The script is idempotent and refuses to run when expected gateway files are absent.
It writes a copy of modified files into `.layer9-integration-backup/` before changes.
"""
from __future__ import annotations

import re
import shutil
from pathlib import Path

ROOT = Path.cwd()
PATCH_DIR = Path(__file__).resolve().parent
FILES = {
    "main": ROOT / "gateway" / "main.py",
    "config": ROOT / "gateway" / "config.py",
    "env": ROOT / "gateway" / ".env.example",
}
router_source = PATCH_DIR / "gateway" / "routers" / "analytics.py"
router_destination = ROOT / "gateway" / "routers" / "analytics.py"
backup_dir = ROOT / ".layer9-integration-backup"


def backup(path: Path) -> None:
    relative = path.relative_to(ROOT)
    destination = backup_dir / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not destination.exists():
        shutil.copy2(path, destination)


def main() -> int:
    missing = [str(path.relative_to(ROOT)) for path in FILES.values() if not path.exists()]
    if not router_source.exists():
        missing.append(str(router_source))
    if missing:
        raise SystemExit("Layer 9 integration stopped; required files not found:\n- " + "\n- ".join(missing))

    main_path = FILES["main"]
    main_text = main_path.read_text(encoding="utf-8")
    if "gateway.routers import" not in main_text:
        raise SystemExit("Could not find the known router import in gateway/main.py; no files changed.")
    if "from gateway.routers import health, auth, webhooks, proxy" not in main_text and "analytics.router" not in main_text:
        raise SystemExit("gateway/main.py router import differs from the expected repo version; inspect manually.")

    config_path = FILES["config"]
    config_text = config_path.read_text(encoding="utf-8")
    if "ANALYTICS_API_URL" not in config_text:
        upstream_pattern = re.compile(r'(?m)^(\s*UPSTREAM_API_URL\s*:\s*str\s*=\s*["\'][^"\']+["\'].*)$')
        config_text, count = upstream_pattern.subn(
            r'\1\n\n    # Private Layer 9 reporting service. Reach it only through this gateway.\n    ANALYTICS_API_URL: str = "http://localhost:8090"',
            config_text,
            count=1,
        )
        if count != 1:
            raise SystemExit("Could not add ANALYTICS_API_URL to gateway/config.py; no files changed.")

    env_path = FILES["env"]
    env_text = env_path.read_text(encoding="utf-8")
    if "ANALYTICS_API_URL=" not in env_text:
        env_text = env_text.replace(
            "UPSTREAM_API_URL=http://localhost:8000",
            "UPSTREAM_API_URL=http://localhost:8000\nANALYTICS_API_URL=http://localhost:8090",
            1,
        )
        if "ANALYTICS_API_URL=" not in env_text:
            env_text += "\n# Private Layer 9 analytics backend\nANALYTICS_API_URL=http://localhost:8090\n"

    if "analytics.router" not in main_text:
        main_text = main_text.replace(
            "from gateway.routers import health, auth, webhooks, proxy",
            "from gateway.routers import health, auth, webhooks, analytics, proxy",
            1,
        )
        main_text = main_text.replace(
            "app.include_router(webhooks.router)\napp.include_router(proxy.router)",
            "app.include_router(webhooks.router)\napp.include_router(analytics.router)\napp.include_router(proxy.router)",
            1,
        )
        if "app.include_router(analytics.router)" not in main_text:
            raise SystemExit("Could not place analytics router before generic proxy router; no files changed.")

    changed = []
    planned = {
        main_path: main_text,
        config_path: config_text,
        env_path: env_text,
    }
    for path, content in planned.items():
        if path.read_text(encoding="utf-8") != content:
            backup(path)
            path.write_text(content, encoding="utf-8")
            changed.append(str(path.relative_to(ROOT)))

    if not router_destination.exists() or router_destination.read_text(encoding="utf-8") != router_source.read_text(encoding="utf-8"):
        if router_destination.exists():
            backup(router_destination)
        else:
            backup_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(router_source, router_destination)
        changed.append(str(router_destination.relative_to(ROOT)))

    print("Layer 9 Gateway integration applied.")
    print("Changed files:" if changed else "No changes needed (already integrated).")
    for item in changed:
        print(f"  - {item}")
    if changed:
        print(f"Backups (original files only): {backup_dir.relative_to(ROOT)}")
    print("Verify the Layer 9 service listens at ANALYTICS_API_URL and keep it private from direct external access.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
