#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UPSTREAM_REMOTE="${UPSTREAM_REMOTE:-upstream}"
UPSTREAM_BRANCH="${UPSTREAM_BRANCH:-main}"
TARGET_REF="${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}"

log() {
  printf '%s\n' "$*"
}

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

read_divergence() {
  local lhs="$1"
  local rhs="$2"
  local raw
  raw="$(git rev-list --left-right --count "${lhs}...${rhs}" | tr '\t' ' ')"
  read -r AHEAD_COUNT BEHIND_COUNT <<<"${raw}"
}

cd "${ROOT_DIR}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  fail "Not a git repository: ${ROOT_DIR}"
fi

if ! git remote get-url "${UPSTREAM_REMOTE}" >/dev/null 2>&1; then
  fail "Remote '${UPSTREAM_REMOTE}' not found."
fi

if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
  fail "Working tree is dirty. Commit or clean changes before rebasing."
fi

CURRENT_BRANCH="$(git symbolic-ref --short -q HEAD || true)"
if [[ -z "${CURRENT_BRANCH}" ]]; then
  fail "Detached HEAD is not supported by this script."
fi

log "Repo: ${ROOT_DIR}"
log "Branch: ${CURRENT_BRANCH}"
log "Target: ${TARGET_REF}"

log "Fetching ${UPSTREAM_REMOTE}..."
git fetch "${UPSTREAM_REMOTE}" --prune

read_divergence "${CURRENT_BRANCH}" "${TARGET_REF}"
log "Before: ${CURRENT_BRANCH} is ahead ${AHEAD_COUNT}, behind ${BEHIND_COUNT} vs ${TARGET_REF}"

if [[ "${BEHIND_COUNT}" -eq 0 ]]; then
  log "No upstream commits to rebase onto."
else
  log "Rebasing ${CURRENT_BRANCH} onto ${TARGET_REF}..."
  git rebase "${TARGET_REF}"
fi

read_divergence "${CURRENT_BRANCH}" "${TARGET_REF}"
log "After:  ${CURRENT_BRANCH} is ahead ${AHEAD_COUNT}, behind ${BEHIND_COUNT} vs ${TARGET_REF}"

if git remote get-url origin >/dev/null 2>&1; then
  read_divergence "${CURRENT_BRANCH}" "origin/${CURRENT_BRANCH}"
  log "Origin: ${CURRENT_BRANCH} is ahead ${AHEAD_COUNT}, behind ${BEHIND_COUNT} vs origin/${CURRENT_BRANCH}"
  if [[ "${AHEAD_COUNT}" -gt 0 ]]; then
    log "Hint: push with 'git push --force-with-lease origin ${CURRENT_BRANCH}' if you want origin aligned."
  fi
fi
