import httpx
import json
import uuid

GATEWAY_URL = "http://127.0.0.1:8080"
BACKEND_URL = "http://127.0.0.1:8000"

def test_api():
    client = httpx.Client(timeout=15.0)

    print("=" * 60)
    print("1. HEALTH CHECKS")
    print("=" * 60)
    res = client.get(f"{GATEWAY_URL}/health")
    print(f"Gateway /health: {res.status_code} -> {res.json()}")

    res = client.get(f"{GATEWAY_URL}/v1/health")
    print(f"Gateway /v1/health: {res.status_code} -> {res.json()}")

    res = client.get(f"{BACKEND_URL}/health")
    print(f"Backend /health: {res.status_code} -> {res.json()}")

    print("\n" + "=" * 60)
    print("2. AUTHENTICATION VIA GATEWAY")
    print("=" * 60)
    login_payload = {
        "email": "elena.rostova@dakini.ai",
        "password": "dakini_secure_2026",
        "tenant_id": "tenant_enterprise_01"
    }
    res = client.post(f"{GATEWAY_URL}/v1/auth/login", json=login_payload)
    print(f"Login status: {res.status_code}")
    auth_data = res.json()
    token = auth_data.get("access_token")
    user = auth_data.get("user")
    print(f"Token received: {bool(token)}")
    print(f"User: {json.dumps(user, indent=2)}")

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "X-Correlation-ID": f"test_req_{uuid.uuid4().hex[:8]}"
    }

    print("\n" + "=" * 60)
    print("3. GET DATA FROM LIVE SUPABASE VIA GATEWAY PROXY")
    print("=" * 60)

    endpoints = [
        ("Leads", "/v1/leads"),
        ("Deals", "/v1/deals"),
        ("Accounts", "/v1/accounts"),
        ("Contacts", "/v1/contacts"),
        ("Campaigns", "/v1/campaigns"),
        ("Tasks", "/v1/tasks"),
        ("Dashboard KPIs", "/v1/dashboard/kpis"),
        ("Users", "/v1/users"),
    ]

    for name, ep in endpoints:
        res = client.get(f"{GATEWAY_URL}{ep}", headers=headers)
        print(f"GET {ep} ({name}): HTTP {res.status_code}")
        if res.status_code == 200:
            body = res.json()
            data = body.get("data", body)
            if isinstance(data, list):
                print(f"   -> Count: {len(data)} items")
                if len(data) > 0:
                    sample = data[0]
                    sample_summary = {k: sample[k] for k in list(sample.keys())[:5]}
                    print(f"   -> Sample item keys: {list(sample.keys())}")
                    print(f"   -> Sample item snippet: {sample_summary}")
            elif isinstance(data, dict):
                print(f"   -> Keys: {list(data.keys())}")
                print(f"   -> Data snippet: {str(data)[:120]}...")
        else:
            print(f"   -> ERROR: {res.text}")

    print("\n" + "=" * 60)
    print("4. TEST CREATE, UPDATE, CONVERT & DELETE")
    print("=" * 60)

    # A. Test Lead Creation (POST)
    new_lead = {
        "name": f"Apex Prospect {uuid.uuid4().hex[:4]}",
        "company": "Supabase Apex Corp",
        "email": f"test.lead.{uuid.uuid4().hex[:6]}@example.com",
        "phone": "+1-555-0199",
        "title": "VP Engineering",
        "status": "new",
        "source": "Outbound",
        "score": 88,
    }
    res = client.post(f"{GATEWAY_URL}/v1/leads", json=new_lead, headers=headers)
    print(f"POST /v1/leads: HTTP {res.status_code}")
    lead_created = res.json()
    lead_data = lead_created.get("data", lead_created)
    lead_id = lead_data.get("id")
    print(f"   -> Created Lead ID: {lead_id}, Name: {lead_data.get('name')}")

    # B. Test Lead Conversion (POST /v1/leads/{id}/convert)
    if lead_id:
        conv_payload = {
            "deal_name": "Apex Enterprise Licensing",
            "deal_amount": 120000.0,
            "company_name": "Supabase Apex Corp"
        }
        res = client.post(f"{GATEWAY_URL}/v1/leads/{lead_id}/convert", json=conv_payload, headers=headers)
        print(f"POST /v1/leads/{lead_id}/convert: HTTP {res.status_code}")
        print(f"   -> Conversion result: {res.json()}")

    # C. Test Account Creation (POST)
    new_account = {
        "name": f"Enterprise Test Account {uuid.uuid4().hex[:4]}",
        "domain": "testaccount.io",
        "industry": "Software & AI",
        "tier": "enterprise",
        "status": "active"
    }
    res = client.post(f"{GATEWAY_URL}/v1/accounts", json=new_account, headers=headers)
    print(f"POST /v1/accounts: HTTP {res.status_code}")
    acc_data = res.json().get("data", res.json())
    account_id = acc_data.get("id")
    print(f"   -> Created Account ID: {account_id}, Name: {acc_data.get('name')}")

    # D. Test Contact Creation (POST)
    new_contact = {
        "first_name": "Alex",
        "last_name": "Rivers",
        "email": f"alex.rivers.{uuid.uuid4().hex[:6]}@example.com",
        "phone": "+1-555-4321",
        "title": "Director of Technology",
        "account_id": account_id
    }
    res = client.post(f"{GATEWAY_URL}/v1/contacts", json=new_contact, headers=headers)
    print(f"POST /v1/contacts: HTTP {res.status_code}")
    con_data = res.json().get("data", res.json())
    contact_id = con_data.get("id")
    print(f"   -> Created Contact ID: {contact_id}")

    # E. Test Deal Creation (POST)
    new_deal = {
        "name": f"Cloud Scale Enterprise Contract {uuid.uuid4().hex[:4]}",
        "account_id": account_id,
        "amount": 75000.0,
        "stage": "Discovery",
    }
    res = client.post(f"{GATEWAY_URL}/v1/deals", json=new_deal, headers=headers)
    print(f"POST /v1/deals: HTTP {res.status_code}")
    deal_data = res.json().get("data", res.json())
    deal_id = deal_data.get("id")
    print(f"   -> Created Deal ID: {deal_id}, Name: {deal_data.get('name')}")

    # F. Test Deal Stage Update (PUT / PATCH)
    if deal_id:
        deal_update = {"stage": "Proposal"}
        res = client.put(f"{GATEWAY_URL}/v1/deals/{deal_id}/stage", json=deal_update, headers=headers)
        print(f"PUT /v1/deals/{deal_id}/stage: HTTP {res.status_code}")
        print(f"   -> Deal Stage updated result: {res.json()}")

    # G. Test Task Creation (POST)
    new_task = {
        "subject": "Follow up on enterprise proposal",
        "priority": "high",
        "type": "task",
        "due_date": "2026-10-30T10:00:00Z"
    }
    res = client.post(f"{GATEWAY_URL}/v1/tasks", json=new_task, headers=headers)
    print(f"POST /v1/tasks: HTTP {res.status_code}")
    task_data = res.json().get("data", res.json())
    task_id = task_data.get("id")
    print(f"   -> Created Task ID: {task_id}")

    # H. Test Clean-up (DELETE)
    print("\n" + "=" * 60)
    print("5. TEST DELETE ENDPOINTS")
    print("=" * 60)
    if lead_id:
        res = client.delete(f"{GATEWAY_URL}/v1/leads/{lead_id}", headers=headers)
        print(f"DELETE /v1/leads/{lead_id}: HTTP {res.status_code}")

    if deal_id:
        res = client.delete(f"{GATEWAY_URL}/v1/deals/{deal_id}", headers=headers)
        print(f"DELETE /v1/deals/{deal_id}: HTTP {res.status_code}")

    if contact_id:
        res = client.delete(f"{GATEWAY_URL}/v1/contacts/{contact_id}", headers=headers)
        print(f"DELETE /v1/contacts/{contact_id}: HTTP {res.status_code}")

    if account_id:
        res = client.delete(f"{GATEWAY_URL}/v1/accounts/{account_id}", headers=headers)
        print(f"DELETE /v1/accounts/{account_id}: HTTP {res.status_code}")

    if task_id:
        res = client.delete(f"{GATEWAY_URL}/v1/tasks/{task_id}", headers=headers)
        print(f"DELETE /v1/tasks/{task_id}: HTTP {res.status_code}")

    print("\n" + "=" * 60)
    print("VERIFICATION COMPLETE")
    print("=" * 60)

if __name__ == "__main__":
    test_api()
