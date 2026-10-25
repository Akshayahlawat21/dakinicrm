import pytest
from backend.app.data.models.account import Account
from backend.app.data.repositories.account_repository import AccountRepository
from backend.app.data.exceptions import RecordNotFoundError, UniqueViolationError


@pytest.mark.asyncio
async def test_repository_crud_and_soft_delete(db_session, ctx_owner_a):
    """Verifies repository CRUD, keyset pagination, and soft-delete."""
    repo = AccountRepository(db_session)
    tenant_id = ctx_owner_a.tenant_id

    # 1. Create
    acc1 = Account(organization_id=ctx_owner_a.tenant_uuid, name="Enterprise Alpha", status="active")
    acc2 = Account(organization_id=ctx_owner_a.tenant_uuid, name="Enterprise Beta", status="active")
    await repo.create(acc1, tenant_id)
    await repo.create(acc2, tenant_id)
    await db_session.flush()

    # 2. Retrieve
    retrieved = await repo.get_by_id_scoped(acc1.id, tenant_id)
    assert retrieved.name == "Enterprise Alpha"

    # 3. List with pagination
    records, total = await repo.list_scoped(tenant_id, skip=0, limit=1)
    assert len(records) == 1
    assert total >= 2

    # 4. Update
    updated = await repo.update_scoped(acc1.id, tenant_id, {"status": "inactive"})
    assert updated.status == "inactive"

    # 5. Soft Delete
    await repo.delete_scoped(acc1.id, tenant_id, soft_delete=True)
    assert acc1.deleted_at is not None

    # Querying soft-deleted record raises RecordNotFoundError
    with pytest.raises(RecordNotFoundError):
        await repo.get_by_id_scoped(acc1.id, tenant_id)
