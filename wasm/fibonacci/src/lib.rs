#[no_mangle]
pub extern "C" fn fib(n: u32) -> u32 {
    if n <= 1 {
        n
    } else {
        fib(n - 1) + fib(n - 2)
    }
}

#[no_mangle]
pub extern "C" fn fib_next(prev: u32, curr: u32) -> u32 {
    prev.wrapping_add(curr)
}
