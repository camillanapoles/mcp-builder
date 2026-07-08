"""Tools for echo-stateless.

Stateless pattern: pure functions, deterministic, no side effects.
"""

from .app import mcp


@mcp.tool()
def echo(text: str) -> str:
    """Return the input text unchanged. Stateless invariant: echo(x) == x."""
    return text


@mcp.tool()
def ping() -> str:
    """Return 'pong'. Stateless invariant: ping() always returns 'pong'."""
    return "pong"
