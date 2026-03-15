export function main() {
  console.log("Hello from tuffc (TypeScript)!");
}

export function compileTuffToJS(input: string): string {
  // Reject negative numbers with type suffixes (e.g., "-100U8")
  if (input.startsWith("-")) {
    let hasDigits = false;
    let hasLetters = false;
    for (let i = 1; i < input.length; i++) {
      const char = input[i];
      if (char >= "0" && char <= "9") {
        hasDigits = true;
      } else if ((char >= "a" && char <= "z") || (char >= "A" && char <= "Z")) {
        hasLetters = true;
      }
    }
    if (hasDigits && hasLetters) {
      throw new Error(
        `Negative numbers with type suffixes are not supported: ${input}`,
      );
    }
  }

  if (input === "") {
    return "return 0";
  }
  // Extract the numeric part, ignoring type suffixes
  let numericValue = "";
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char >= "0" && char <= "9") {
      numericValue += char;
    } else {
      break;
    }
  }
  // If we found a numeric value, return it; otherwise quote the input as a string
  if (numericValue) {
    return `return ${numericValue}`;
  }
  return `return "${input}"`;
}
