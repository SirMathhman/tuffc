function findMatchingParen(text: string, openIdx: number): number {
  let depth = 0;
  let i = openIdx;
  while (i < text.length) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")") {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

function extractParamNames(paramsRaw: string): string {
  const trimmed = paramsRaw.trim();
  if (trimmed === "") return "";
  const parts = trimmed.split(",");
  let out = "";
  let i = 0;
  while (i < parts.length) {
    const p = parts[i].trim();
    const colonIdx = p.indexOf(":");
    let name = p;
    if (colonIdx !== -1) {
      name = p.substring(0, colonIdx).trim();
    }
    // Rename 'this' to '_this' because 'this' is a reserved keyword in JavaScript
    if (name === "this") {
      name = "_this";
    }
    if (out !== "") out += ", ";
    out += name;
    i++;
  }
  return out;
}

export { findMatchingParen, extractParamNames };
