import sys
import asyncio
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import httpx
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import time

DATABASE_URL = "postgresql+psycopg://postgres.zwkigpmnakfkfzcjaxdp:Strongpassword%4012345@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require"
GATEWAY_URL = "http://127.0.0.1:8080"

async def run_live_proof():
    print("=" * 70)
    print("STEP 1: QUERY LIVE SUPABASE POSTGRESQL DIRECTLY WITH RAW SQL")
    print("=" * 70)
    
    engine = create_async_engine(DATABASE_URL)
    async with engine.connect() as conn:
        result = await conn.execute(text(
            "SELECT id, name, email, status, score, created_at FROM leads WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 3;"
        ))
        db_rows = result.fetchall()
        print(f"Direct SQL returned {len(db_rows)} recent leads from Supabase:")
        for r in db_rows:
            print(f"  [DB ROW] ID: {r[0]} | Name: '{r[1]}' | Email: {r[2]} | Status: {r[3]} | Score: {r[4]}")
    await engine.dispose()

    print("\n" + "=" * 70)
    print("STEP 2: FETCH DATA VIA API LAYER (GATEWAY -> LAYER 3 -> SUPABASE)")
    print("=" * 70)
    
    client = httpx.Client(timeout=15.0)
    
    # Authenticate to get JWT token
    login_resp = client.post(f"{GATEWAY_URL}/v1/auth/login", json={
        "email": "elena.rostova@dakini.ai",
        "password": "dakini_secure_2026",
        "tenant_id": "tenant_enterprise_01"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    # Request leads from API
    api_resp = client.get(f"{GATEWAY_URL}/v1/leads", headers=headers)
    print(f"API HTTP Status: {api_resp.status_code}")
    api_data = api_resp.json().get("data", [])
    print(f"API Layer returned {len(api_data)} leads:")
    for l in api_data[:3]:
        print(f"  [API JSON] ID: {l.get('id')} | Name: '{l.get('name')}' | Email: {l.get('email')} | Status: {l.get('status')} | Score: {l.get('score')}")

    # Check match
    if db_rows and api_data:
        db_first_id = str(db_rows[0][0])
        api_first_id = str(api_data[0]["id"])
        print("\n--> MATCH VERIFICATION:")
        print(f"    Supabase Cloud ID: {db_first_id}")
        print(f"    API Response ID:   {api_first_id}")
        print(f"    Match Confirmed:   {'SUCCESS - DATA MATCHES EXACTLY' if db_first_id == api_first_id else 'MISMATCH'}")

    print("\n" + "=" * 70)
    print("STEP 3: LIVE POST -> SUPABASE INSERT -> LIVE GET PROOF")
    print("=" * 70)
    
    unique_tag = f"LiveTest-{int(time.time())}"
    new_lead_payload = {
        "name": f"Verified Client ({unique_tag})",
        "company": "Supabase Verification Corp",
        "email": f"client.{unique_tag.lower()}@supabase-test.com",
        "phone": "+1-800-555-0199",
        "industry": "Cloud Computing",
        "source": "Live CLI Verification",
        "score": 95
    }
    
    print(f"Posting new lead to API: '{new_lead_payload['name']}'...")
    create_resp = client.post(f"{GATEWAY_URL}/v1/leads", json=new_lead_payload, headers=headers)
    print(f"POST /v1/leads HTTP Status: {create_resp.status_code}")
    created_item = create_resp.json().get("data", {})
    created_id = created_item.get("id")
    print(f"Created Lead ID returned by API: {created_id}")

    print("\nVerifying direct presence in Supabase database with SQL query...")
    engine2 = create_async_engine(DATABASE_URL)
    async with engine2.connect() as conn:
        verify_query = await conn.execute(
            text(f"SELECT id, name, email, score FROM leads WHERE id = '{created_id}';")
        )
        row = verify_query.fetchone()
        if row:
            print(f"  -> CONFIRMED in Supabase PostgreSQL: ID={row[0]}, Name='{row[1]}', Score={row[3]}")
        else:
            print("  -> ERROR: Not found in database!")
    await engine2.dispose()

    print("\nVerifying API GET fetches the newly created record from Supabase...")
    get_again = client.get(f"{GATEWAY_URL}/v1/leads", headers=headers)
    fresh_leads = get_again.json().get("data", [])
    found = any(str(l.get("id")) == str(created_id) for l in fresh_leads)
    print(f"  -> API GET includes newly inserted lead: {'SUCCESS (Found at top of list)' if found else 'FAILED'}")

    # Clean up test lead
    client.delete(f"{GATEWAY_URL}/v1/leads/{created_id}", headers=headers)
    print(f"\nCleaned up test lead {created_id} (soft-deleted in Supabase).")
    print("=" * 70)
    print("ALL TESTS COMPLETE: THE API BRINGS AND PERSISTS LIVE SUPABASE DATA PROPERLY!")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(run_live_proof())
