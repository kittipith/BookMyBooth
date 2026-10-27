"""กันไม่ให้ template หลุดกฎของ Learner Lab (PLAN หัวข้อ 1 และ 13)"""

from template_util import load_template, resources_of_type


def test_no_iam_resources():
    iam = [
        rid for rid, r in load_template()["Resources"].items() if r["Type"].startswith("AWS::IAM::")
    ]
    assert iam == []


def test_globals_has_no_role():
    # SAM ไม่รองรับ Role ใน Globals ต้องใส่ทีละ Function
    assert "Role" not in load_template()["Globals"]["Function"]


def test_every_function_uses_lab_role_without_policies():
    functions = resources_of_type("AWS::Serverless::Function")
    assert functions
    for logical_id, fn in functions.items():
        props = fn["Properties"]
        assert "LabRoleName" in props.get("Role", ""), f"{logical_id} ต้องใช้ LabRole"
        assert "Policies" not in props, f"{logical_id} ใช้ Policies แล้ว SAM จะสร้าง role ใหม่"


def test_every_table_has_env_var():
    env = load_template()["Globals"]["Function"]["Environment"]["Variables"]
    referenced = {value for value in env.values() if isinstance(value, str)}
    for logical_id in resources_of_type("AWS::DynamoDB::Table"):
        assert logical_id in referenced, f"{logical_id} ไม่มี env var ใน Globals"
