"""Property-based tests for echo-stateless (Hypothesis)."""

from __future__ import annotations

from hypothesis import given, strategies as st

from echo_stateless.tools import echo, ping


@given(st.text(min_size=0, max_size=10000))
def test_echo_never_crashes(text: str):
    """echo must never raise for any string input."""
    result = echo(text)
    assert isinstance(result, str)


@given(st.text())
def test_echo_is_identity(text: str):
    """echo must return input unchanged (identity function)."""
    assert echo(text) == text


@given(st.text())
def test_echo_deterministic_property(text: str):
    """echo(x) === echo(x) — stateless invariant."""
    assert echo(text) == echo(text)


@given(st.text())
def test_echo_idempotent(text: str):
    """echo(echo(x)) === echo(x) — idempotent property."""
    assert echo(echo(text)) == echo(text)


def test_ping_always_pong():
    """ping() must always return 'pong' — stateless invariant."""
    for _ in range(100):
        assert ping() == "pong"
