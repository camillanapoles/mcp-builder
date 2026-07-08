"""Unit tests for echo-stateless tools."""

from __future__ import annotations

import pytest

from echo_stateless.tools import echo, ping


class TestEcho:
    """Tests for the echo tool."""

    def test_echo_returns_input(self):
        assert echo("hello") == "hello"

    def test_echo_empty_string(self):
        assert echo("") == ""

    def test_echo_unicode(self):
        assert echo("héllo wörld") == "héllo wörld"

    def test_echo_deterministic(self):
        """Stateless invariant: same input → same output."""
        assert echo("test") == echo("test")

    def test_echo_no_side_effects(self):
        """Tool must not mutate global state."""
        import echo_stateless.tools as mod
        before = dict(vars(mod))
        echo("anything")
        after = dict(vars(mod))
        assert before.keys() == after.keys()

    @pytest.mark.parametrize("text", [
        "a", "ab", "abc", "hello world", "123", "!@#$%",
    ])
    def test_echo_parametrized(self, text):
        assert echo(text) == text


class TestPing:
    """Tests for the ping tool."""

    def test_ping_returns_pong(self):
        assert ping() == "pong"

    def test_ping_deterministic(self):
        assert ping() == ping()

    def test_ping_takes_no_args(self):
        """Ping should work without arguments (stateless)."""
        import inspect
        sig = inspect.signature(ping)
        # ping is decorated by @mcp.tool(); check underlying func if accessible
        # for now just call without args
        result = ping()
        assert result == "pong"
