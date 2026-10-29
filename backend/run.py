import sys
import os
import asyncio

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Critical for psycopg3 async driver on Windows
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import uvicorn
from backend.app.core.config import settings


def get_loop_factory():
    """Uvicorn loop factory for Windows psycopg compatibility."""
    return asyncio.SelectorEventLoop()


def main():
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        loop_setting = "asyncio:SelectorEventLoop"
    else:
        loop_setting = "auto"
    
    print(f"[RUNNER] Starting Layer 3 Application API with loop={loop_setting}...", flush=True)
    uvicorn.run(
        "backend.app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
        loop=loop_setting,
    )


if __name__ == "__main__":
    main()
