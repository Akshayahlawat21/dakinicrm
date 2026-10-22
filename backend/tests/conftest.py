import uuid
import pytest
import pytest_asyncio
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool
from sqlalchemy import event
from httpx import AsyncClient, ASGITransport

from backend.app.data.models.base import Base
from backend.app.data.models.organization import Organization, Team, TeamMember
from backend.app.data.models.user import User
from backend.app.application.context import RequestContext
from backend.app.main import app
from backend.app.data.session import get_db_session

# Test database URL
TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture(scope="function")
async def test_engine():
    engine = create_async_engine(
        TEST_DB_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db_session(test_engine):
    session_factory = async_sessionmaker(
        bind=test_engine,
        class_=AsyncSession,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
    )
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture(scope="function")
async def seed_data(db_session: AsyncSession):
    """Seeds multi-tenant test hierarchy with Tenant A, Tenant B, teams, and users."""
    # 1. Organizations
    tenant_a = Organization(
        id=uuid.UUID("11111111-1111-1111-1111-111111111111"),
        name="Acme Enterprise (Tenant A)",
        slug="acme-enterprise",
    )
    tenant_b = Organization(
        id=uuid.UUID("22222222-2222-2222-2222-222222222222"),
        name="Globex Corp (Tenant B)",
        slug="globex-corp",
    )
    db_session.add_all([tenant_a, tenant_b])
    await db_session.flush()

    # 2. Teams in Tenant A
    team_alpha = Team(
        id=uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
        organization_id=tenant_a.id,
        name="Enterprise Alpha Team",
    )
    team_beta = Team(
        id=uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
        organization_id=tenant_a.id,
        name="SMB Beta Team",
    )
    db_session.add_all([team_alpha, team_beta])
    await db_session.flush()

    # 3. Users in Tenant A
    owner_a = User(
        id=uuid.UUID("a1000000-0000-0000-0000-000000000001"),
        organization_id=tenant_a.id,
        name="Alice Owner",
        email="alice.owner@acme.com",
        role_name="owner",
        status="active",
    )
    manager_a1 = User(
        id=uuid.UUID("a2000000-0000-0000-0000-000000000001"),
        organization_id=tenant_a.id,
        name="Bob Manager Alpha",
        email="bob.manager@acme.com",
        role_name="manager",
        status="active",
    )
    manager_a2 = User(
        id=uuid.UUID("a2000000-0000-0000-0000-000000000002"),
        organization_id=tenant_a.id,
        name="Charles Manager Beta",
        email="charles.manager@acme.com",
        role_name="manager",
        status="active",
    )
    sales_a1 = User(
        id=uuid.UUID("a3000000-0000-0000-0000-000000000001"),
        organization_id=tenant_a.id,
        name="David Sales Alpha",
        email="david.sales@acme.com",
        role_name="salesperson",
        manager_id=manager_a1.id,
        status="active",
    )
    sales_a2 = User(
        id=uuid.UUID("a3000000-0000-0000-0000-000000000002"),
        organization_id=tenant_a.id,
        name="Eva Sales Beta",
        email="eva.sales@acme.com",
        role_name="salesperson",
        manager_id=manager_a2.id,
        status="active",
    )

    # 4. Users in Tenant B
    owner_b = User(
        id=uuid.UUID("b1000000-0000-0000-0000-000000000001"),
        organization_id=tenant_b.id,
        name="Zack Owner B",
        email="zack.owner@globex.com",
        role_name="owner",
        status="active",
    )
    manager_b = User(
        id=uuid.UUID("b2000000-0000-0000-0000-000000000001"),
        organization_id=tenant_b.id,
        name="Yara Manager B",
        email="yara.manager@globex.com",
        role_name="manager",
        status="active",
    )
    sales_b = User(
        id=uuid.UUID("b3000000-0000-0000-0000-000000000001"),
        organization_id=tenant_b.id,
        name="Xander Sales B",
        email="xander.sales@globex.com",
        role_name="salesperson",
        status="active",
    )

    db_session.add_all([owner_a, manager_a1, manager_a2, sales_a1, sales_a2, owner_b, manager_b, sales_b])
    await db_session.flush()

    # 5. Team memberships
    member_bob = TeamMember(team_id=team_alpha.id, user_id=manager_a1.id)
    member_david = TeamMember(team_id=team_alpha.id, user_id=sales_a1.id)
    member_charles = TeamMember(team_id=team_beta.id, user_id=manager_a2.id)
    member_eva = TeamMember(team_id=team_beta.id, user_id=sales_a2.id)
    db_session.add_all([member_bob, member_david, member_charles, member_eva])

    await db_session.commit()

    return {
        "tenant_a": tenant_a,
        "tenant_b": tenant_b,
        "team_alpha": team_alpha,
        "team_beta": team_beta,
        "owner_a": owner_a,
        "manager_a1": manager_a1,
        "manager_a2": manager_a2,
        "sales_a1": sales_a1,
        "sales_a2": sales_a2,
        "owner_b": owner_b,
        "manager_b": manager_b,
        "sales_b": sales_b,
    }


# Context Fixtures
@pytest.fixture
def ctx_owner_a(seed_data):
    return RequestContext(
        user_id=str(seed_data["owner_a"].id),
        tenant_id=str(seed_data["tenant_a"].id),
        role="owner",
        correlation_id="req_test_owner_a",
    )


@pytest.fixture
def ctx_manager_a1(seed_data):
    return RequestContext(
        user_id=str(seed_data["manager_a1"].id),
        tenant_id=str(seed_data["tenant_a"].id),
        role="manager",
        team_id=str(seed_data["team_alpha"].id),
        correlation_id="req_test_manager_a1",
    )


@pytest.fixture
def ctx_manager_a2(seed_data):
    return RequestContext(
        user_id=str(seed_data["manager_a2"].id),
        tenant_id=str(seed_data["tenant_a"].id),
        role="manager",
        team_id=str(seed_data["team_beta"].id),
        correlation_id="req_test_manager_a2",
    )


@pytest.fixture
def ctx_sales_a1(seed_data):
    return RequestContext(
        user_id=str(seed_data["sales_a1"].id),
        tenant_id=str(seed_data["tenant_a"].id),
        role="salesperson",
        team_id=str(seed_data["team_alpha"].id),
        correlation_id="req_test_sales_a1",
    )


@pytest.fixture
def ctx_sales_a2(seed_data):
    return RequestContext(
        user_id=str(seed_data["sales_a2"].id),
        tenant_id=str(seed_data["tenant_a"].id),
        role="salesperson",
        team_id=str(seed_data["team_beta"].id),
        correlation_id="req_test_sales_a2",
    )


@pytest.fixture
def ctx_owner_b(seed_data):
    return RequestContext(
        user_id=str(seed_data["owner_b"].id),
        tenant_id=str(seed_data["tenant_b"].id),
        role="owner",
        correlation_id="req_test_owner_b",
    )


@pytest.fixture
def ctx_sales_b(seed_data):
    return RequestContext(
        user_id=str(seed_data["sales_b"].id),
        tenant_id=str(seed_data["tenant_b"].id),
        role="salesperson",
        correlation_id="req_test_sales_b",
    )


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession):
    """Provides AsyncClient with database session overridden."""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db_session] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
