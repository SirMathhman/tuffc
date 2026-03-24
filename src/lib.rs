pub fn interpret_tuff(input: &str) -> i32 {
    let digits: String = input.chars().take_while(|ch| ch.is_ascii_digit()).collect();

    digits.parse().unwrap_or(0)
}

pub use interpret_tuff as interpretTuff;
