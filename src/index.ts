export function main() {
  console.log("Hello from tuffc (TypeScript)!");
}

export function compileTuffToJS(input: string): string {
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
