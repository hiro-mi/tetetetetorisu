#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd -- "$SCRIPT_DIR/../.." && pwd)

IMAGE_NAME="mis-sast:latest"

if [[ -n "${MIS_SAST_DOCKER_IMAGE:-}" ]]; then
  IMAGE_NAME="$MIS_SAST_DOCKER_IMAGE"
else
  docker build -t "$IMAGE_NAME" "$REPO_ROOT"
fi

trivy image "$IMAGE_NAME"
