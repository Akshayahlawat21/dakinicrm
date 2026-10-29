import sys
import os
import asyncio

# Ensure project root and analytics dir are in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# Critical for psycopg3 async driver on Windows
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import uvicorn


def main():
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        loop_setting = "asyncio:SelectorEventLoop"
    else:
        loop_setting = "auto"

    print(f"[RUNNER] Starting Layer 9 Analytics API with loop={loop_setting}...", flush=True)
    uvicorn.run(
        "app.main:app",
        app_dir="analytics",
        host="127.0.0.1",
        port=8090,
        reload=True,
        loop=loop_setting,
    )


if __name__ == "__main__":
    main()
