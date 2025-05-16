from typing import List

from app.models.prompt import PromptSection
from .prompt_templates import (
    FIXED_OUTPUT_REQUIREMENT_TEMPLATE,
    TASK_INFO_TEMPLATE,
    CHARACTER_INFO_TEMPLATE,
)


# Public ---------------------------------------------------------------------

def assemble_prompt(sections: List[PromptSection], language: str = "en") -> str:
    """Return a single XML string assembled from *sections*.

    Parameters
    ----------
    sections : List[PromptSection]
        The list of user-defined editable prompt sections.
    language : str, default "en"
        Workspace language used for tag generation.  Currently only English is
        fully supported; other languages fall back to English-named tags.

    Returns
    -------
    str
        Concatenation of fixed templates followed by the user section XML in
        correct order.  No root wrapper element is added.
    """
    if not sections:
        user_section_xml = ""
    else:
        _normalize_order(sections)
        # After normalisation, sort ascending by *order*
        sorted_sections = sorted(sections, key=lambda s: s.order)

        xml_chunks: List[str] = []
        for sec in sorted_sections:
            tag = _tag_name(sec.typeId, language, sec.name)
            wrapped = _wrap(tag, sec.content or "")
            xml_chunks.append(wrapped)
        user_section_xml = "\n\n".join(xml_chunks)

    # Prepend fixed templates (strip leading / trailing newlines for neatness)
    templates = [
        FIXED_OUTPUT_REQUIREMENT_TEMPLATE.strip(),
        TASK_INFO_TEMPLATE.strip(),
        CHARACTER_INFO_TEMPLATE.strip(),
    ]
    templates_xml = "\n\n".join(templates)

    if templates_xml and user_section_xml:
        return f"{templates_xml}\n\n{user_section_xml}"
    elif templates_xml:
        return templates_xml
    else:
        return user_section_xml


# Helpers --------------------------------------------------------------------

def _normalize_order(sections: List[PromptSection]) -> None:
    """Ensure every section has an integer *order*; fill gaps in-place."""
    for idx, sec in enumerate(sections):
        if sec.order is None:
            sec.order = idx


def _wrap(tag: str, content: str) -> str:
    """Wrap *content* in `<tag>` opening and closing tags."""
    return f"<{tag}>{content}</{tag}>"


def _tag_name(type_id: str, language: str = "en", section_name: str | None = None) -> str:
    """Return the XML tag name for *type_id*.

    For ``type_id == 'custom'`` (or any unknown id) the name is derived from
    the *section_name* supplied by the user and sanitised to ASCII, falling
    back to ``Custom_Section`` if a name isn't available.
    """
    type_id_lower = (type_id or "").lower()

    # Mapping for English workspaces (default)
    mapping_en = {
        "role": "Role_Definition",
        "context": "Context",
        "instructions": "Instructions",
        "examples": "Examples",
    }

    if type_id_lower in mapping_en:
        return mapping_en[type_id_lower]

    # Custom or unknown → derive from name
    if section_name:
        return _sanitize_tag(section_name)

    return "Custom_Section"


def _sanitize_tag(raw: str) -> str:
    """Convert *raw* user-input into a safe ASCII tag.

    • Strip leading/trailing whitespace.
    • Replace spaces and invalid characters with underscores.
    • Collapse consecutive underscores.
    • Ensure the tag starts with a letter; prefix with 'C_' if not.
    """
    import re

    tag = raw.strip()
    # Replace non-alphanumeric with underscore
    tag = re.sub(r"[^0-9a-zA-Z]+", "_", tag)
    # Collapse repeating underscores
    tag = re.sub(r"_+", "_", tag)
    # Remove leading/trailing underscore
    tag = tag.strip("_")
    # Ensure starts with alpha char per XML naming rules
    if not tag or not tag[0].isalpha():
        tag = f"C_{tag}"
    return tag or "Custom_Section" 