#!/bin/sh
set -eu
# The mounted disk may be owned by root. Only this fixed mount is prepared as root.
case "${WORKSHOP_DATA_DIR:-}" in
  /var/data|/var/data/workshop|/var/data/restored) ;;
  *) echo 'Container data directory must be /var/data, /var/data/workshop or /var/data/restored' >&2; exit 1 ;;
esac
mkdir -p "$WORKSHOP_DATA_DIR"
chown node:node "$WORKSHOP_DATA_DIR"
# A kernel-held lock survives PID namespaces and releases automatically on crash.
export WORKSHOP_OS_LOCKED=1
exec flock --nonblock --no-fork /var/data/process.lock gosu node "$@"
