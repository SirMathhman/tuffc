import { type Result, ok, err } from "./types";

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

function parseNumericLiteral(
  input: string,
): Result<{ sign: string; number: string; type: string | undefined }, string> {
  let pos = 0;

  // Check for optional sign
  let sign = "";
  if (pos < input.length && input[pos] === "-") {
    sign = "-";
    pos++;
  }

  // Parse digits before decimal point
  if (pos >= input.length || !isDigit(input[pos])) {
    return err(`Invalid numeric literal: ${input}`);
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
      return err(`Invalid numeric literal: ${input}`);
    }

    while (pos < input.length && isDigit(input[pos])) {
      number += input[pos];
      pos++;
    }
  }

  // Check for optional type annotation
  let type: string | undefined;
  if (pos < input.length) {
    // Expect a letter followed by digit(s)
    const char = input[pos];
    if (!isLetter(char)) {
      return err(`Invalid numeric literal: ${input}`);
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
      return err(`Invalid type annotation: ${potentialType}`);
    }

    type = potentialType;
  }

  // Ensure we've consumed the entire input
  if (pos !== input.length) {
    return err(`Invalid numeric literal: ${input}`);
  }

  return ok({ sign, number, type });
}

function isLetter(char: string | undefined): boolean {
  return (
    (char !== undefined && char >= "a" && char <= "z") ||
    (char !== undefined && char >= "A" && char <= "Z")
  );
}

export function compile(input: string): Result<string, string> {
  // Empty input returns 0
  if (input === "") {
    return ok("return 0;");
  }

  // Disallow any whitespace
  if (input !== input.trim() || hasWhitespace(input)) {
    return err("Whitespace is not allowed in numeric literals");
  }

  const parseResult = parseNumericLiteral(input);
  if (!parseResult.ok) {
    return parseResult;
  }

  const { sign, number, type } = parseResult.value;

  // Validate: negative numbers can only be signed (I) or float (F)
  if (sign === "-" && type && !type.startsWith("I") && !type.startsWith("F")) {
    return err(
      `Cannot apply negative sign to unsigned type: -${number}${type}`,
    );
  }

  // Construct the final number value
  const finalNumber = sign + number;

  return ok(`return ${finalNumber};`);
}
