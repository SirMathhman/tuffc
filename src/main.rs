pub fn interpret_tuff(input: String) -> i32 {
    let input = input.trim();
    if input.is_empty() {
        return 0;
    }

    let bytes = input.as_bytes();
    let mut index = 0;
    let mut negative = false;

    if bytes[index] == b'+' || bytes[index] == b'-' {
        negative = bytes[index] == b'-';
        index += 1;
    }

    let digit_start = index;
    while index < bytes.len() && bytes[index].is_ascii_digit() {
        index += 1;
    }

    if index == digit_start {
        return 0;
    }

    let digits = &input[digit_start..index];
    let suffix = &input[index..];

    let suffix_is_valid = suffix.is_empty()
        || matches!(
            suffix,
            "U8" | "U16" | "U32" | "U64" | "I8" | "I16" | "I32" | "I64"
        );
    if !suffix_is_valid {
        return 0;
    }

    let value = match digits.parse::<i128>() {
        Ok(value) => value,
        Err(_) => return 0,
    };

    let value = if negative { -value } else { value };
    if value < i32::MIN as i128 || value > i32::MAX as i128 {
        return 0;
    }

    value as i32
}

#[cfg(test)]
mod tests {
    use super::interpret_tuff;

    #[test]
    fn parses_number_with_u8_suffix() {
        assert_eq!(interpret_tuff("100U8".to_string()), 100);
    }

    #[test]
    fn parses_number_without_suffix() {
        assert_eq!(interpret_tuff("100".to_string()), 100);
    }

    #[test]
    fn parses_signed_number_with_suffix() {
        assert_eq!(interpret_tuff("-7I16".to_string()), -7);
    }

    #[test]
    fn returns_zero_for_empty_input() {
        assert_eq!(interpret_tuff("".to_string()), 0);
    }

    #[test]
    fn returns_zero_for_non_numeric_input() {
        assert_eq!(interpret_tuff("abc".to_string()), 0);
    }

    #[test]
    fn returns_zero_for_overflowing_input() {
        assert_eq!(interpret_tuff("2147483648U64".to_string()), 0);
    }

    #[test]
    fn returns_zero_for_unsupported_suffix() {
        assert_eq!(interpret_tuff("42X9".to_string()), 0);
    }
}

fn main() {
    println!("Hello, world!");
}
