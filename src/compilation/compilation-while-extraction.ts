import { skipWhitespace } from "./compilation-if-else";

function extractWhileAndAfter(
  text: string,
): { whileStmt: string; after: string } | null {
  if (!text.startsWith("while")) return null;
  const i = skipWhitespace(text, 5);
  if (text[i] !== "(") return null;
  let parenDepth = 0;
  let condEnd = i;
  while (condEnd < text.length) {
    if (text[condEnd] === "(") {
      parenDepth++;
    } else if (text[condEnd] === ")") {
      parenDepth--;
      if (parenDepth === 0) break;
    }
    condEnd++;
  }
  if (condEnd >= text.length) return null;
  const bodyStart = skipWhitespace(text, condEnd + 1);
  if (text[bodyStart] !== "{") return null;
  let braceDepth = 0;
  let bodyEnd = bodyStart;
  while (bodyEnd < text.length) {
    if (text[bodyEnd] === "{") {
      braceDepth++;
    } else if (text[bodyEnd] === "}") {
      braceDepth--;
      if (braceDepth === 0) {
        bodyEnd++;
        break;
      }
    }
    bodyEnd++;
  }
  return {
    whileStmt: text.substring(0, bodyEnd),
    after: text.substring(bodyEnd).trim(),
  };
}

export { extractWhileAndAfter };
