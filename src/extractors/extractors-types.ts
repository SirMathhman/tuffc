function extractAfterEq(stmt: string): string {
  const eqIndex = stmt.indexOf("=");
  return stmt.substring(eqIndex + 1).trim();
}

function extractDeclaredType(stmt: string): string {
  if (stmt.substring(0, 4) !== "let ") {
    return "";
  }
  const eqIndex = stmt.indexOf("=");
  const colonIndex = stmt.indexOf(":");
  if (colonIndex === -1) {
    return "";
  }
  if (eqIndex !== -1 && colonIndex > eqIndex) {
    return "";
  }
  let typeStart = colonIndex + 1;
  while (typeStart < stmt.length && stmt[typeStart] === " ") {
    typeStart++;
  }
  let typeEnd = typeStart;
  while (
    typeEnd < stmt.length &&
    ((stmt[typeEnd] >= "a" && stmt[typeEnd] <= "z") ||
      (stmt[typeEnd] >= "A" && stmt[typeEnd] <= "Z") ||
      (stmt[typeEnd] >= "0" && stmt[typeEnd] <= "9") ||
      stmt[typeEnd] === "*")
  ) {
    typeEnd++;
  }
  return stmt.substring(typeStart, typeEnd);
}

function extractReadType(stmt: string): string {
  const readIndex = stmt.indexOf("read<");
  if (readIndex === -1) {
    return "";
  }
  const typeStart = readIndex + 5;
  let typeEnd = typeStart;
  while (typeEnd < stmt.length && stmt[typeEnd] !== ">") {
    typeEnd++;
  }
  return stmt.substring(typeStart, typeEnd);
}

export { extractAfterEq, extractDeclaredType, extractReadType };
