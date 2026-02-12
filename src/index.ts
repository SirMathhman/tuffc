console.log("Hello from Bun and TypeScript!");

interface User {
  id: number;
  name: string;
}

const user: User = {
  id: 1,
  name: "Bun User",
};

console.log(`Welcome, ${user.name}!`);

function interpret(input: string): number {
  throw new Error("Not implemented");
}
