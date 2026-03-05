const VALID_TYPES = new Set([
  "U8",
  "U16",
  "U32",
  "U64",
  "I8",
  "I16",
  "I32",
  "I64",
  "F32",
  "F64",
]);

function hasWhitespace(input: string): boolean {
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (
      char === " " ||
      char === "\t" ||
      char === "\n" ||
      char === "\r" ||
      char === "\v" ||
      char === "\f"
    ) {
      return true;
    }
  }
  return false;
}

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= "0" && char <= "9";
}

function parseNumericLiteral(input: string): {
  sign: string;
  number: string;
  type: string | null;
} {
  let pos = 0;

  // Check for optional sign
  let sign = "";
  if (pos < input.length && input[pos] === "-") {
    sign = "-";
    pos++;
  }

  // Parse digits before decimal point
  if (pos >= input.length || !isDigit(input[pos])) {
    throw new Error(`Invalid numeric literal: ${input}`);
  }

  let number = "";
  while (pos < input.length && isDigit(input[pos])) {
    number += input[pos];
    pos++;
  }

  // Check for optional decimal point
  if (pos < input.length && input[pos] === ".") {
    number += ".";
    pos++;

    // Must have at least one digit after decimal
    if (pos >= input.length || !isDigit(input[pos])) {
      throw new Error(`Invalid numeric literal: ${input}`);
    }

    while (pos < input.length && isDigit(input[pos])) {
      number += input[pos];
      pos++;
    }
  }

  // Check for optional type annotation
  let type: string | null = null;
  if (pos < input.length) {
    // Expect a letter followed by digit(s)
    const char = input[pos];
    if (!isLetter(char)) {
      throw new Error(`Invalid numeric literal: ${input}`);
    }

    let potentialType = "";
    while (
      pos < input.length &&
      (isLetter(input[pos]) || isDigit(input[pos]))
    ) {
      potentialType += input[pos];
      pos++;
    }

    if (!VALID_TYPES.has(potentialType)) {
      throw new Error(`Invalid type annotation: ${potentialType}`);
    }

    type = potentialType;
  }

  // Ensure we've consumed the entire input
  if (pos !== input.length) {
    throw new Error(`Invalid numeric literal: ${input}`);
  }

  return { sign, number, type };
}

function isLetter(char: string | undefined): boolean {
  return (
    (char !== undefined && char >= "a" && char <= "z") ||
    (char !== undefined && char >= "A" && char <= "Z")
  );
}

export function compile(input: string): string {
  // Empty input returns 0
  if (input === "") {
    return "return 0;";
  }

  // Disallow any whitespace
  if (input !== input.trim() || hasWhitespace(input)) {
    throw new Error("Whitespace is not allowed in numeric literals");
  }

  const { sign, number, type } = parseNumericLiteral(input);

  // Validate: negative numbers can only be signed (I) or float (F)
  if (sign === "-" && type && !type.startsWith("I") && !type.startsWith("F")) {
    throw new Error(
      `Cannot apply negative sign to unsigned type: -${number}${type}`,
    );
  }

  // Construct the final number value
  const finalNumber = sign + number;

  return `return ${finalNumber};`;
}
