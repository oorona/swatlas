#!/usr/bin/env bash
# swatlas test entry point.
#   ./test.sh python    pytest: dataset validation, NumPy recomputation, bundle checks
#   ./test.sh frontend  typecheck + Vitest
#   ./test.sh e2e       production build + Playwright (standalone server)
#   ./test.sh backend   not applicable (frontend-only project)
#   ./test.sh all       everything above
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

run_python() { (cd "$ROOT/scripts/authoring" && uv run --frozen pytest -q); }
run_frontend() { (cd "$ROOT/frontend" && npm run typecheck && npm test); }
run_e2e() { (cd "$ROOT/frontend" && npm run build && npm run test:e2e); }

case "${1:-all}" in
  python) run_python ;;
  frontend) run_frontend ;;
  e2e) run_e2e ;;
  backend) echo "backend: not applicable (swatlas has no backend service)" ;;
  all) run_python; run_frontend; echo "backend: not applicable"; run_e2e ;;
  *) echo "Usage: ./test.sh [python|frontend|e2e|backend|all]"; exit 2 ;;
esac
