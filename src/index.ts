type Result<T, E> = { type: "ok"; value: T } | { type: "err"; error: E };

function ok<T, E>(value: T): Result<T, E> {
  return { type: "ok", value };
}

function err<T, E>(error: E): Result<T, E> {
  return { type: "err", error };
}

export function compile(source: string): Result<string, string> {
  const trimmed = source.trim();

  if (trimmed === "") {
    return ok("0");
  }

  // Try parsing as a full number first
  let num = Number(trimmed);
  if (!Number.isNaN(num) && String(num) === trimmed) {
    return ok(trimmed);
  }

  // Check if input starts with minus sign
  const isNegative = trimmed[0] === "-";
  const numericStart = isNegative ? 1 : 0;

  // Extract numeric part (skip minus sign if present)
  let numericPart = "";
  let endIndex = numericStart;
  for (let i = numericStart; i < trimmed.length; i++) {
    const char = trimmed[i];
    if ((char >= "0" && char <= "9") || char === ".") {
      numericPart += char;
      endIndex = i + 1;
    } else {
      break;
    }
  }

  if (numericPart !== "") {
    num = Number(numericPart);
    if (!Number.isNaN(num)) {
      // Check if there's a type suffix after the numeric part
      const hasSuffix = endIndex < trimmed.length;

      // Negative numbers with type suffixes are not allowed
      if (isNegative && hasSuffix) {
        return err(
          `Negative numbers with type suffixes are not allowed: ${trimmed}`,
        );
      }

      return ok(isNegative ? "-" + numericPart : numericPart);
    }
  }

  return ok("0");
}
