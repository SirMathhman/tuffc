const message = "Hello from Bun!";

function compileTuffToJS(source) {
  return String(source);
}

function main() {
  console.log(message);
}

if (import.meta.main) {
  main();
}

export { compileTuffToJS, main, message };
