export function main() {
  console.log("Hello from tuffc (TypeScript)!");
}

export function compileTuffToJS(input: string): string {
  if (input === "") {
    return "return 0";
  }
  // Extract the numeric part, ignoring type suffixes
  const numericMatch = input.match(/^\d+/);
  const numericValue = numericMatch ? numericMatch[0] : input;
  return `return ${numericValue}`;
}
