# Fibonacci WASM module

This module powers the `WASM vs JS` demo.

## Build

```bash
rustup target add wasm32-unknown-unknown
rustc \
  --target wasm32-unknown-unknown \
  --crate-type cdylib \
  -O \
  src/lib.rs \
  -o ../../public/wasm/fib.wasm
```

The generated `public/wasm/fib.wasm` artifact is intentionally not committed; build it locally when needed.
