# Fibonacci WASM module

This module powers the `WASM vs JS` demo.

## Build behavior

The demo's WebAssembly binary is compiled from `wasm/fibonacci/src/lib.rs` during both local development and production builds via:

```bash
npm run build:wasm
```

That command runs `scripts/build-wasm.sh`, which:

1. Ensures Rust is installed.
2. Adds the `wasm32-unknown-unknown` target.
3. Compiles `src/lib.rs` to `public/wasm/fib.wasm`.

`public/wasm/fib.wasm` is generated at build time and is intentionally not committed.
