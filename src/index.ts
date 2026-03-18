export function getGreeting(): string {
  return "Hello from TypeScript!";
}

export function interpretTuff(input: string): number {
  const match = /^(\d+)U8$/.exec(input);

  if (!match) {
    throw new Error(`Unsupported Tuff input: ${input}`);
  }

  return Number.parseInt(match[1], 10);
}

export function main(): void {
  console.log(getGreeting());
}

if (require.main === module) {
  main();
}
