import boto3
from boto3.dynamodb.conditions import Key

from shared import db


def test_tables_match_template(aws):
    names = set(boto3.client("dynamodb").list_tables()["TableNames"])
    assert names == {
        "UsersTable",
        "EventsTable",
        "LotsTable",
        "BookingsTable",
        "NotificationsTable",
    }


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
