import sys
import asyncio
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

url = "postgresql+psycopg://postgres.zwkigpmnakfkfzcjaxdp:Strongpassword%4012345@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require"

async def check():
    try:
        engine = create_async_engine(url)
        async with engine.connect() as conn:
            res = await conn.execute(text("SELECT current_database(), current_user;"))
            print("Connected to Supabase successfully:", res.fetchall())
            tables = await conn.execute(text(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
            ))
            table_list = [r[0] for r in tables.fetchall()]
            print("Public tables:", table_list)
            for t in ["users", "leads", "deals", "accounts", "contacts", "campaigns", "tasks"]:
                if t in table_list:
                    count = await conn.execute(text(f"SELECT count(*) FROM {t};"))
                    print(f"  Table {t} count:", count.scalar())
        await engine.dispose()
    except Exception as e:
        print("Connection error:", e)

if __name__ == "__main__":
    asyncio.run(check())
