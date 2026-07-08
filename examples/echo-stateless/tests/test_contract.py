"""Contract tests for echo-stateless — validate MCP protocol shape."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from echo_stateless.app import mcp

PROJECT_ROOT = Path(__file__).parent.parent


def test_mcp_server_name():
    assert mcp.name == "echo-stateless"


def test_pyproject_declares_mcp_dep():
    pyproject = (PROJECT_ROOT / "pyproject.toml").read_text()
    assert "mcp[cli]" in pyproject or 'mcp"' in pyproject


def test_fsm_states_yaml_exists():
    states_yaml = PROJECT_ROOT / ".mcp" / "state" / "states.yaml"
    assert states_yaml.exists()


def test_fsm_transitions_yaml_exists():
    t = PROJECT_ROOT / ".mcp" / "state" / "transitions.yaml"
    assert t.exists()


def test_states_yaml_has_required_states():
    import yaml
    states = yaml.safe_load((PROJECT_ROOT / ".mcp" / "state" / "states.yaml").read_text())
    state_names = list(states["states"].keys())
    assert "idle" in state_names
    assert "running" in state_names
    assert "completed" in state_names
    assert "failed" in state_names


def test_transitions_have_required_fields():
    import yaml
    t = yaml.safe_load((PROJECT_ROOT / ".mcp" / "state" / "transitions.yaml").read_text())
    for tr in t["transitions"]:
        assert "from" in tr
        assert "to" in tr
        assert "event" in tr


def test_tools_return_string():
    """MCP tools must return strings (will be wrapped as text content)."""
    from echo_stateless.tools import echo, ping
    assert isinstance(echo("test"), str)
    assert isinstance(ping(), str)


def test_echo_tool_shape():
    """echo accepts text and returns it unchanged."""
    from echo_stateless.tools import echo
    result = echo("contract test")
    assert result == "contract test"


def test_ping_tool_shape():
    from echo_stateless.tools import ping
    assert ping() == "pong"
