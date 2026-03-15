import { main, compileTuffToJS } from "./index";
import * as readline from "readline";

async function runREPL() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("Tuff Compiler REPL (type 'exit' to quit)");

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };

  let running = true;
  while (running) {
    const input = await question("> ");

    if (input.toLowerCase() === "exit") {
      running = false;
      console.log("Goodbye!");
      break;
    }

    const result = compileTuffToJS(input);

    if (result.isErr()) {
      console.log(`Error: ${result.error}`);
    } else {
      try {
        const output = new Function(result.value)();
        console.log(`Result: ${output}`);
      } catch (err) {
        console.log(`Evaluation error: ${err}`);
      }
    }
  }

  rl.close();
}

main();
runREPL().catch((err) => {
  console.error("REPL Error:", err);
  process.exit(1);
});
