export function compile(source: string): string {
  const trimmed = source.trim();

  if (trimmed === "") {
    return "0";
  }

  // Try parsing as a full number first
  let num = Number(trimmed);
  if (!Number.isNaN(num) && String(num) === trimmed) {
    return trimmed;
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
        throw new Error(
          `Negative numbers with type suffixes are not allowed: ${trimmed}`,
        );
      }

      return isNegative ? "-" + numericPart : numericPart;
    }
  }

  return "0";
}
