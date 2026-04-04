import { createInterface } from "node:readline";

function __tuff_tokenize(input) {
  const str = String(input).trim();
  if (str.length === 0) {
    return [];
  }

  const tokens = [];
  let current = "";

  for (const ch of str) {
    if (ch.trim() === "") {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

function __tuff_coerce(value) {
  if (value === "true") {
    return 1;
  }

  if (value === "false") {
    return 0;
  }

  return Number(value);
}

const rl = createInterface({ input: process.stdin, terminal: false });
const lines = [];
rl.on("line", (line) => lines.push(line));
rl.on("close", () => {
  const __tokens = __tuff_tokenize(lines.join("\n"));
  let __tokenIndex = 0;
  const __tuff_read = () => __tokens[__tokenIndex++];
  const __result = ((__tuff_read, __tuff_coerce) => {
    return __tuff_coerce(__tuff_read());
  })(__tuff_read, __tuff_coerce);
  process.stdout.write(String(__result) + "\n");
});