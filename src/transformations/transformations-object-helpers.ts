function parseObjectName(
  source: string,
  startIdx: number,
): { name: string; braceStart: number } | null {
  let nameEnd = startIdx;
  while (nameEnd < source.length && source[nameEnd] === " ") nameEnd++;
  const nameStart = nameEnd;
  while (
    nameEnd < source.length &&
    source[nameEnd] !== " " &&
    source[nameEnd] !== "{"
  )
    nameEnd++;
  const objectName = source.substring(nameStart, nameEnd);
  let braceStart = nameEnd;
  while (braceStart < source.length && source[braceStart] === " ") braceStart++;
  if (source[braceStart] !== "{") return null;
  return { name: objectName, braceStart };
}

function extractMembers(body: string): { vars: string[]; fns: string[] } {
  const vars: string[] = [];
  const fns: string[] = [];
  let i = 0;
  while (i < body.length) {
    if (body.substring(i, i + 4) === "let ") {
      let start = i + 4;
      if (body.substring(start, start + 4) === "mut ") start += 4;
      let end = start;
      while (
        end < body.length &&
        body[end] !== " " &&
        body[end] !== "=" &&
        body[end] !== ":"
      )
        end++;
      const name = body.substring(start, end).trim();
      if (name !== "") vars.push(name);
    }
    if (body.substring(i, i + 3) === "fn ") {
      const start = i + 3;
      let end = start;
      while (end < body.length && body[end] !== "(" && body[end] !== " ") end++;
      const name = body.substring(start, end).trim();
      if (name !== "") fns.push(name);
    }
    i++;
  }
  return { vars, fns };
}

function buildReturnObject(vars: string[], fns: string[]): string {
  if (vars.length === 0 && fns.length === 0) return "{}";
  const members: string[] = [];
  let i = 0;
  while (i < fns.length) {
    members.push(fns[i] + ": " + fns[i]);
    i++;
  }
  let j = 0;
  while (j < vars.length) {
    members.push("get " + vars[j] + "() { return " + vars[j] + "; }");
    j++;
  }
  return "{ " + members.join(", ") + " }";
}
export { parseObjectName, extractMembers, buildReturnObject };
