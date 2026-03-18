export function getGreeting(): string {
  return "Hello from TypeScript!";
}

export function main(): void {
  console.log(getGreeting());
}

if (require.main === module) {
  main();
}
