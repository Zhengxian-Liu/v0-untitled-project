import pytest

# Ensure project root is on PYTHONPATH so that `app` package can be imported when
# tests are executed directly (e.g. `pytest tests/...`).
import sys, pathlib
root_dir = pathlib.Path(__file__).resolve().parents[1]
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from app.core.prompt_assembler import assemble_prompt
from app.models.prompt import PromptSection


def _make_section(id_: str, type_id: str, content: str, order: int, name: str = ""):
    return PromptSection(id=id_, typeId=type_id, name=name or type_id, content=content, order=order)


def test_assemble_prompt_basic():
    sections = [
        _make_section("1", "role", "You are helpful", 2),
        _make_section("2", "instructions", "Do X", 1),
    ]
    xml = assemble_prompt(sections, language="en")

    # Templates should come first
    assert xml.startswith("<OUTPUT_REQUIREMENTS>")

    # User sections must appear after templates in the correct order
    idx_instr = xml.find("<Instructions>")
    idx_role = xml.find("<Role_Definition>")
    assert idx_instr != -1 and idx_role != -1 and idx_instr < idx_role


def test_unknown_typeid_falls_back_to_custom():
    sections = [
        _make_section("x", "unknown", "abc", 0),
    ]
    xml = assemble_prompt(sections)
    assert "<unknown>abc</unknown>" in xml


def test_empty_sections_list_returns_only_templates():
    xml = assemble_prompt([], language="en")
    # Should still include templates
    assert "<OUTPUT_REQUIREMENTS>" in xml and "<your_task>" in xml


def test_custom_section_uses_name():
    sections = [
        _make_section("1", "custom", "hello", 0, name="My Special Part"),
    ]
    xml = assemble_prompt(sections)
    assert "<My_Special_Part>hello</My_Special_Part>" in xml 