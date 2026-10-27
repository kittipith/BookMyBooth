import boto3
from boto3.dynamodb.conditions import Key

from shared import db
from tables import TABLES


def test_every_table_name_resolves(aws):
    created = set(boto3.client("dynamodb").list_tables()["TableNames"])
    for name in ("users", "events", "lots", "bookings", "notifications"):
        assert db.table_name(name) in created
    assert len(created) == len(TABLES)


def test_gsi_query(aws):
    users = db.table("users")
    users.put_item(
        Item={
            "userId": "u1",
            "roleStatus": "ORGANIZER#PENDING",
            "createdAt": "2026-10-27T00:00:00Z",
        }
    )
    users.put_item(
        Item={"userId": "u2", "roleStatus": "SELLER#ACTIVE", "createdAt": "2026-10-27T00:00:01Z"}
    )

    result = users.query(
        IndexName="byRoleStatus", KeyConditionExpression=Key("roleStatus").eq("ORGANIZER#PENDING")
    )

    assert [item["userId"] for item in result["Items"]] == ["u1"]
