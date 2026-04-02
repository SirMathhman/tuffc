import { message } from "./index.js";

function main() {
  console.log(message);
}

if (import.meta.main) {
  main();
}

export { main };
