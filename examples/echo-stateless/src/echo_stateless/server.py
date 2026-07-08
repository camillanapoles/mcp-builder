"""echo-stateless MCP server entry point."""

from __future__ import annotations

import logging

from .app import mcp
from . import tools  # noqa: F401 — registers @mcp.tool()
from .resources import register_resources

logger = logging.getLogger("echo_stateless")

register_resources(mcp)


def main() -> None:
    """Run the MCP server over stdio."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    logger.info("starting echo-stateless MCP server")
    mcp.run()


if __name__ == "__main__":
    main()
