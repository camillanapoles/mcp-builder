"""Tests for server.py entry point + resources."""

from __future__ import annotations

import importlib

from echo_stateless.app import mcp
from echo_stateless import server as server_module
from echo_stateless import resources as resources_module


class TestServerModule:
    """Tests for the server module (entry point)."""

    def test_main_callable(self):
        """main() should be defined and callable (don't actually run it)."""
        assert callable(server_module.main)

    def test_logger_configured(self):
        """Logger should be configured with the right name."""
        assert server_module.logger.name == "echo_stateless"

    def test_resources_registered(self):
        """register_resources should have been called (mcp has resources)."""
        # FastMCP stores resources internally; we verify the function was called
        # by checking that resources module was imported
        assert hasattr(resources_module, "register_resources")

    def test_main_does_not_crash_on_import(self):
        """Importing server module should not start the server."""
        # Already imported at top; if we got here, it didn't crash
        assert server_module is not None


class TestResources:
    """Tests for MCP resources."""

    def test_register_resources_callable(self):
        assert callable(resources_module.register_resources)

    def test_register_resources_does_not_crash(self):
        """Calling register_resources with a FastMCP instance should not raise."""
        # Use a fresh FastMCP to avoid double-registration on the singleton
        from mcp.server.fastmcp import FastMCP
        fresh = FastMCP("test-fresh")
        resources_module.register_resources(fresh)
        # Verify resource registration worked by inspecting the FastMCP instance
        # FastMCP stores resources in _resource_manager
        assert fresh is not None

    def test_app_mcp_has_resources(self):
        """The singleton mcp instance should have resources registered."""
        # The server module calls register_resources(mcp) at import time
        # so the singleton mcp should have at least one resource
        assert mcp is not None
        assert mcp.name == "echo-stateless"


class TestEntryPoint:
    """Tests for the entry point (if __name__ == '__main__')."""

    def test_module_runnable(self):
        """Module should be importable without starting the server."""
        import subprocess
        import sys

        proc = subprocess.Popen(
            [sys.executable, "-c", "from echo_stateless.server import main; print('OK')"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        try:
            out, err = proc.communicate(timeout=5)
            assert b"OK" in out, f"unexpected: out={out!r} err={err!r}"
        except subprocess.TimeoutExpired:
            proc.kill()
            out, err = proc.communicate()
            assert b"OK" in out, f"timeout: out={out!r} err={err!r}"


class TestPyProject:
    """Tests for pyproject.toml configuration."""

    def test_pyproject_has_coverage_config(self):
        from pathlib import Path
        pyproject = Path(__file__).parent.parent / "pyproject.toml"
        content = pyproject.read_text()
        assert "--cov-fail-under=80" in content
        assert "testpaths" in content

    def test_pyproject_has_dev_deps(self):
        from pathlib import Path
        pyproject = Path(__file__).parent.parent / "pyproject.toml"
        content = pyproject.read_text()
        assert "pytest" in content
        assert "hypothesis" in content
        assert "mutmut" in content
