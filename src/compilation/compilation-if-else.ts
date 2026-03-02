function skipWhitespace(text: string, startIndex: number): number {
  let i = startIndex;
  while (i < text.length && (text[i] === " " || text[i] === "\t")) {
    i++;
  }
  return i;
}

function skipBlock(text: string, startIndex: number): number {
  let i = startIndex;
  if (i < text.length && text[i] === "{") {
    let braceDepth = 0;
    while (i < text.length) {
      if (text[i] === "{") braceDepth++;
      else if (text[i] === "}") {
        braceDepth--;
        if (braceDepth === 0) {
          i++;
          break;
        }
      }
      i++;
    }
  }
  return i;
}

function extractIfElseAndAfter(text: string): {
  ifElse: string;
  after: string;
} | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("if ") && !trimmed.startsWith("if(")) {
    return null;
  }

  let i = 0;

  // Skip "if"
  i = trimmed.indexOf("if") + 2;

  // Skip to first '('
  while (i < trimmed.length && trimmed[i] !== "(") {
    i++;
  }

  // Skip the condition in parentheses
  if (i < trimmed.length && trimmed[i] === "(") {
    let parenDepth = 0;
    while (i < trimmed.length) {
      if (trimmed[i] === "(") parenDepth++;
      else if (trimmed[i] === ")") {
        parenDepth--;
        if (parenDepth === 0) {
          i++;
          break;
        }
      }
      i++;
    }
  }

  i = skipWhitespace(trimmed, i);
  i = skipBlock(trimmed, i);
  i = skipWhitespace(trimmed, i);

  // Check for else
  if (i < trimmed.length && trimmed.substring(i, i + 4) === "else") {
    i += 4;
    i = skipWhitespace(trimmed, i);
    i = skipBlock(trimmed, i);
  }

  const ifElse = trimmed.substring(0, i).trim();
  const after = trimmed.substring(i).trim();
  return { ifElse, after };
}

export { extractIfElseAndAfter, skipWhitespace };
