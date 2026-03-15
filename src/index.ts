export function main() {
  console.log("Hello from tuffc (TypeScript)!");
}

export function compileTuffToJS(input: string): string {
  if (input === "") {
    return "return 0";
  }
  return `return ${input}`;
}
