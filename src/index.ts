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
