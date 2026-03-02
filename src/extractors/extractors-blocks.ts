/* eslint-disable max-lines */
import { extractIdentifier } from "./extractors-identifiers";

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

function extractBlockContent(afterEq: string, blockEnd: number): string {
  const block = afterEq.substring(0, blockEnd + 1);
  return block.substring(1, block.length - 1).trim();
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
        callback(varName, isMut, i, varStart + varName.length);
        i = varStart + varName.length;
      } else {
        i++;
      }
    } else {
      i++;
    }
  }
}

export {
  findBlockEnd,
  extractBlockAndAfter,
  extractBlockContent,
  forEachAddressOf,
};
