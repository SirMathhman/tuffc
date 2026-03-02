function isDigit(c: string): boolean {
  return c >= "0" && c <= "9";
}

function isAlpha(c: string): boolean {
  return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");
}

function extractIdentifier(str: string, startIndex: number): string {
  let identifier = "";
  let i = startIndex;
  while (
    i < str.length &&
    ((str[i] >= "a" && str[i] <= "z") ||
      (str[i] >= "A" && str[i] <= "Z") ||
      (str[i] >= "0" && str[i] <= "9") ||
      str[i] === "_")
  ) {
    identifier += str[i];
    i++;
  }
  return identifier;
}

function extractNumericPart(
  source: string,
  startIndex: number,
): { numericPart: string; endIndex: number } {
  let numericPart = "";
  let endIndex = startIndex;
  let i = startIndex;
  while (i < source.length) {
    const char = source[i];
    if (isDigit(char) || char === ".") {
      numericPart += char;
      endIndex = i + 1;
      i++;
    } else {
      break;
    }
  }
  return { numericPart, endIndex };
}

function extractAfterEq(stmt: string): string {
  const eqIndex = stmt.indexOf("=");
  return stmt.substring(eqIndex + 1).trim();
}

function extractDeclaredType(stmt: string): string {
  if (stmt.substring(0, 4) !== "let ") {
    return "";
  }
  const colonIndex = stmt.indexOf(":");
  if (colonIndex === -1) {
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

function findBlockEnd(text: string): number {
  let braceDepth = 0;
  let i = 0;
  while (i < text.length) {
    if (text[i] === "{") {
      braceDepth++;
    } else if (text[i] === "}") {
      braceDepth--;
      if (braceDepth === 0) {
        return i;
      }
    }
    i++;
  }
  return -1;
}

function extractBlockAndAfter(text: string): {
  block: string | null;
  after: string;
} {
  let braceDepth = 0;
  let blockStart = -1;
  let blockEnd = -1;

  let i = 0;
  while (i < text.length) {
    if (text[i] === "{") {
      if (braceDepth === 0) {
        blockStart = i;
      }
      braceDepth++;
    } else if (text[i] === "}") {
      braceDepth--;
      if (braceDepth === 0) {
        blockEnd = i + 1;
        break;
      }
    }
    i++;
  }

  if (blockStart === -1) {
    return { block: null, after: text };
  }

  const block = text.substring(blockStart, blockEnd);
  const after = text.substring(blockEnd).trim();
  return { block, after };
}

function advancePast(varStart: number, varName: string): number {
  return varStart + varName.length;
}

function forEachAddressOf(
  source: string,
  callback: (
    _varName: string,
    _isMut: boolean,
    _position: number,
    _varEnd: number,
  ) => void,
): void {
  let i = 0;
  while (i < source.length) {
    if (source[i] === "&") {
      let varStart = i + 1;
      let isMut = false;
      if (source.substring(i + 1, i + 5) === "mut ") {
        varStart = i + 5;
        isMut = true;
      }
      const varName = extractIdentifier(source, varStart);
      if (varName !== "") {
        callback(varName, isMut, i, advancePast(varStart, varName));
        i = advancePast(varStart, varName);
      } else {
        i++;
      }
    } else {
      i++;
    }
  }
}

function extractBlockContent(afterEq: string, blockEnd: number): string {
  const block = afterEq.substring(0, blockEnd + 1);
  return block.substring(1, block.length - 1).trim();
}

function isAssignmentOperator(source: string, position: number): boolean {
  return source.substring(position, position + 3) === " = ";
}

export {
  isDigit,
  isAlpha,
  extractIdentifier,
  extractNumericPart,
  extractAfterEq,
  extractDeclaredType,
  extractReadType,
  findBlockEnd,
  extractBlockAndAfter,
  advancePast,
  forEachAddressOf,
  extractBlockContent,
  isAssignmentOperator,
};
