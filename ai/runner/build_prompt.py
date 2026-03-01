"""
Reads a .md prompt template from ai/agent/src/prompts/ and replaces
{{VARIABLE_NAME}} placeholders with values from a context dict.
"""

import re
from pathlib import Path

PROMPTS_DIR = Path(__file__).parent.parent / "agent" / "src" / "prompts"


def build_prompt(prompt_name: str, context: dict[str, str] = {}) -> str:
    path = PROMPTS_DIR / f"{prompt_name}.md"
    template = path.read_text(encoding="utf-8")

    for key, value in context.items():
        template = template.replace("{{" + key + "}}", value or "")

    return template


def list_prompt_variables(prompt_name: str) -> list[str]:
    path = PROMPTS_DIR / f"{prompt_name}.md"
    template = path.read_text(encoding="utf-8")
    return list(dict.fromkeys(re.findall(r"\{\{([A-Z_]+)\}\}", template)))
