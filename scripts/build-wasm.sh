#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_FILE="$ROOT_DIR/wasm/fibonacci/src/lib.rs"
OUT_FILE="$ROOT_DIR/public/wasm/fib.wasm"

if ! command -v rustc >/dev/null 2>&1; then
  echo "Error: rustc is required to build the WASM demo artifact." >&2
  echo "Install Rust from https://rustup.rs/ before running npm run build." >&2
  exit 1
fi

rustup target add wasm32-unknown-unknown >/dev/null
rustc \
  --target wasm32-unknown-unknown \
  --crate-type cdylib \
  -O \
  "$SRC_FILE" \
  -o "$OUT_FILE"

echo "Built WASM artifact at $OUT_FILE"
