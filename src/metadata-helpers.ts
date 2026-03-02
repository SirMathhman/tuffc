import { VariableInfo } from "./types";

function pushIfNonEmpty(statements: string[], text: string): void {
  const trimmed = text.trim();
  if (trimmed !== "") {
    statements.push(trimmed);
  }
}

function splitStatementsKeepBlocks(source: string): string[] {
  const statements: string[] = [];
  let current = "";
  let braceDepth = 0;
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (char === "{") {
      braceDepth++;
      current += char;
    } else if (char === "}") {
      braceDepth--;
      current += char;
    } else if (char === ";" && braceDepth === 0) {
      pushIfNonEmpty(statements, current);
      current = "";
    } else {
      current += char;
    }
    i++;
  }
  pushIfNonEmpty(statements, current);
  return statements;
}

function findVariable(
  varName: string,
  metadata: VariableInfo[],
): VariableInfo | undefined {
  let i = 0;
  while (i < metadata.length) {
    if (metadata[i].name === varName) {
      return metadata[i];
    }
    i++;
  }
  return undefined;
}

function parseBlockStatements(blockContent: string): string[] {
  return blockContent
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s);
}

function getLastStatement(stmts: string[]): string {
  return stmts[stmts.length - 1];
}

export {
  pushIfNonEmpty,
  splitStatementsKeepBlocks,
  findVariable,
  parseBlockStatements,
  getLastStatement,
};
