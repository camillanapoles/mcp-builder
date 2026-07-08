"""MCP resources for echo-stateless."""

from typing import Any

from mcp.server.fastmcp import FastMCP


def register_resources(mcp: FastMCP) -> None:
    """Register read-only resources."""

    @mcp.resource("schema://tools")
    def list_tools_schema() -> dict[str, Any]:
        return {
            "server": "echo-stateless",
            "pattern": "stateless",
            "tools": [
                {"name": "echo", "description": "Return input text unchanged"},
                {"name": "ping", "description": "Return 'pong'"},
            ],
        }

    @mcp.resource("state://fsm")
    def current_state() -> dict[str, str]:
        return {"state": "idle", "pattern": "stateless"}
