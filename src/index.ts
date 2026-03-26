export function greet(name: string): string {
  return `Hello, ${name}!`;
}

if (import.meta.main) {
  const name = process.argv[2] ?? "world";
  console.log(greet(name));
}
