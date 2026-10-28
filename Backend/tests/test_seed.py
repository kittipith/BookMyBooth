import boto3

from domain import events, users
from helpers import cognito_groups
from seed import DEMO_ACCOUNTS, seed_accounts, seed_event
from shared import clock, db


def run_seed(pool_id):
    return seed_accounts(
        cognito=boto3.client("cognito-idp"),
        users_table=db.table("users"),
        pool_id=pool_id,
        password="Passw0rd!",
    )


def test_seed_creates_active_accounts_in_groups(user_pool):
    seeded = run_seed(user_pool)

    assert {item["role"] for item in seeded} == set(users.ROLES)
    for item in seeded:
        assert item["status"] == users.ACTIVE
        assert cognito_groups(user_pool, item["username"]) == {users.GROUP_OF_ROLE[item["role"]]}
        assert db.table("users").get_item(Key={"userId": item["userId"]})["Item"]["email"]


def test_seed_event_is_open_with_lots(user_pool):
    organizer = next(item for item in run_seed(user_pool) if item["role"] == users.ORGANIZER)

    event = seed_event(
        events_table=db.table("events"),
        lots_table=db.table("lots"),
        organizer=organizer,
        now=clock.now(),
    )
    seed_event(
        events_table=db.table("events"),
        lots_table=db.table("lots"),
        organizer=organizer,
        now=clock.now(),
    )

    assert events.display_status(event, clock.now()) == events.OPEN
    stored = db.scan_all("lots")
    assert len(stored) == 12
    assert {lot["zoneId"] for lot in stored} == {"A", "B"}


def test_admin_gets_own_password(user_pool):
    client = boto3.client("cognito-idp")
    passwords = {}
    real_set = client.admin_set_user_password

    def record(**kwargs):
        passwords[kwargs["Username"]] = kwargs["Password"]
        return real_set(**kwargs)

    client.admin_set_user_password = record
    seeded = seed_accounts(
        cognito=client,
        users_table=db.table("users"),
        pool_id=user_pool,
        password="Passw0rd!",
        admin_password="Adm1nOnly!",
    )

    by_role = {item["role"]: passwords[item["username"]] for item in seeded}
    assert by_role[users.ADMIN] == "Adm1nOnly!"
    assert by_role[users.SELLER] == by_role[users.ORGANIZER] == "Passw0rd!"


def test_seed_is_rerunnable(user_pool):
    first = run_seed(user_pool)
    second = run_seed(user_pool)

    assert [item["userId"] for item in first] == [item["userId"] for item in second]
    assert len(db.scan_all("users")) == len(DEMO_ACCOUNTS)
