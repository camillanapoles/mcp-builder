#!/bin/bash
# Local monitor hook — file watcher for constant local monitoring
# Part of MCP Builder hooks system: monitor category
#
# Watches builder/src/ for changes and auto-runs build + test
# Enables constant local monitoring as requested for event-driven architecture

set -e

echo "🔍 Monitor: Starting file watcher for builder/src/"
echo "   Press Ctrl+C to stop"
echo ""

PROJECT_ROOT="$(git rev-parse --show-toplevel)"
cd "$PROJECT_ROOT/builder"

# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install > /dev/null 2>&1
fi

# Build once before watching
echo "🔨 Initial build..."
npm run build > /dev/null 2>&1
echo "✅ Build complete"
echo ""

# Watch for changes
# Using simple poll-based approach (works everywhere, no additional deps)
while true; do
  # Check if any .ts file changed in last 2 seconds
  CHANGED=$(find src/ -name "*.ts" -newermt "2 seconds ago" 2>/dev/null || true)

  if [ -n "$CHANGED" ]; then
    echo ""
    echo "📝 Change detected in:"
    echo "$CHANGED" | head -3
    echo ""

    # Run typecheck
    echo "  → Type checking..."
    if npm run typecheck > /dev/null 2>&1; then
      echo "    ✅ Typecheck passed"

      # Rebuild
      echo "  → Building..."
      if npm run build > /dev/null 2>&1; then
        echo "    ✅ Build complete"

        # Run tests
        echo "  → Running tests..."
        if npm test 2>&1 | grep -q "Test Files.*passed"; then
          echo "    ✅ All tests passed"
        else
          echo "    ❌ Tests failed — check output above"
        fi
      else
        echo "    ❌ Build failed — check errors above"
      fi
    else
      echo "    ❌ Typecheck failed — check errors above"
    fi

    echo ""
    echo "🔍 Monitoring... (Ctrl+C to stop)"
  fi

  sleep 2
done
