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

  // Try extracting numeric prefix (handles type suffixes like U8, I32, etc.)
  let numericPart = "";
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    if ((char >= "0" && char <= "9") || char === ".") {
      numericPart += char;
    } else {
      break;
    }
  }

  if (numericPart !== "") {
    num = Number(numericPart);
    if (!Number.isNaN(num)) {
      return numericPart;
    }
  }

  return "0";
}
