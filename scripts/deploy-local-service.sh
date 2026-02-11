#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_NAME="${OPENCLAW_SERVICE:-openclaw-gateway.service}"
RUN_PROBE=0

log() {
  printf '%s\n' "$*"
}

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

run_step() {
  local label="$1"
  shift
  log "==> ${label}"
  "$@"
}

usage() {
  cat <<'EOF'
Usage: scripts/deploy-local-service.sh [--probe]

Builds OpenClaw from source and restarts the local user service.

Options:
  --probe   Run 'node openclaw.mjs channels status --probe' after restart
  -h, --help
EOF
}

for arg in "$@"; do
  case "${arg}" in
    --probe)
      RUN_PROBE=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown option: ${arg}"
      ;;
  esac
done

cd "${ROOT_DIR}"

command -v pnpm >/dev/null 2>&1 || fail "pnpm is required."
command -v node >/dev/null 2>&1 || fail "node is required."
command -v systemctl >/dev/null 2>&1 || fail "systemctl is required."

run_step "pnpm install" pnpm install
run_step "pnpm build" pnpm build
run_step "pnpm ui:build" pnpm ui:build
run_step "restart ${SERVICE_NAME}" systemctl --user restart "${SERVICE_NAME}"
run_step "check service active" systemctl --user is-active "${SERVICE_NAME}"

log "==> ExecStart"
systemctl --user show "${SERVICE_NAME}" --property=ExecStart --value --no-pager

run_step "OpenClaw CLI version" node openclaw.mjs --version

if [[ "${RUN_PROBE}" -eq 1 ]]; then
  run_step "channels status probe" node openclaw.mjs channels status --probe
fi
