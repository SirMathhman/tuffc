const message = "Hello from Bun!";

function main() {
  console.log(message);
}

if (import.meta.main) {
  main();
}

export { main, message };
