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

static mut TIMED_PREV: u32 = 0;
static mut TIMED_CURR: u32 = 1;
static mut TIMED_SCORE: u32 = 0;

#[no_mangle]
pub extern "C" fn fib_timed_reset() {
    unsafe {
        TIMED_PREV = 0;
        TIMED_CURR = 1;
        TIMED_SCORE = 0;
    }
}

#[no_mangle]
pub extern "C" fn fib_timed_step_many(iters: u32) -> u32 {
    unsafe {
        for _ in 0..iters {
            let next = TIMED_PREV.wrapping_add(TIMED_CURR);
            TIMED_PREV = TIMED_CURR;
            TIMED_CURR = next;
            TIMED_SCORE = TIMED_SCORE.wrapping_add(1);
        }

        TIMED_SCORE
    }
}
