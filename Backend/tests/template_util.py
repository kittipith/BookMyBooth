from functools import cache
from pathlib import Path

import yaml

TEMPLATE_PATH = Path(__file__).resolve().parents[1] / "template.yaml"


class _CfnLoader(yaml.SafeLoader):
    """อ่าน template ที่มี tag ของ CloudFormation (!Ref, !Sub, ...) โดยเก็บค่าภายในไว้เฉย ๆ"""


def _construct_tag(loader: yaml.SafeLoader, _suffix: str, node: yaml.Node):
    if isinstance(node, yaml.ScalarNode):
        return loader.construct_scalar(node)
    if isinstance(node, yaml.SequenceNode):
        return loader.construct_sequence(node, deep=True)
    return loader.construct_mapping(node, deep=True)


_CfnLoader.add_multi_constructor("!", _construct_tag)


@cache
def load_template() -> dict:
    return yaml.load(TEMPLATE_PATH.read_text(encoding="utf-8"), Loader=_CfnLoader)


def resources_of_type(resource_type: str) -> dict[str, dict]:
    return {
        logical_id: resource
        for logical_id, resource in load_template()["Resources"].items()
        if resource["Type"] == resource_type
    }
