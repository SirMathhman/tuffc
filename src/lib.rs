pub fn interpret_tuff(input: &str) -> Result<i128, String> {
    let trimmed = input.trim();

    if trimmed.is_empty() {
        return Ok(0);
    }

    for (suffix, min, max) in [
        ("U8", 0i128, 255i128),
        ("U16", 0i128, 65_535i128),
        ("U32", 0i128, 4_294_967_295i128),
        ("U64", 0i128, 18_446_744_073_709_551_615i128),
        ("I8", -128i128, 127i128),
        ("I16", -32_768i128, 32_767i128),
        ("I32", -2_147_483_648i128, 2_147_483_647i128),
        (
            "I64",
            -9_223_372_036_854_775_808i128,
            9_223_372_036_854_775_807i128,
        ),
    ] {
        if let Some(number) = trimmed.strip_suffix(suffix) {
            let value = number
                .parse::<i128>()
                .map_err(|_| format!("invalid literal: {trimmed}"))?;

            if value < min || value > max {
                return Err(format!("value out of range for {suffix}: {value}"));
            }

            return Ok(value);
        }
    }

    trimmed
        .parse::<i128>()
        .map_err(|_| format!("invalid literal: {trimmed}"))
}

pub use interpret_tuff as interpretTuff;
