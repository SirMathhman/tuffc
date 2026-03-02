import { skipWhitespace, matchParenDepth } from "./transformations-if-expr-utils";

function transformMethodCalls(source: string): string {
  let result = "";
  let i = 0;
  while (i < source.length) {
    if (source[i] === ".") {
      const beforeDot = result.trimEnd();
      if (!isValidReceiver(beforeDot)) {
        result += ".";
        i++;
        continue;
      }

      const receiver = extractReceiver(beforeDot);
      if (!receiver) {
        result += ".";
        i++;
        continue;
      }

      const beforeReceiver = beforeDot.substring(
        0,
        beforeDot.length - receiver.length,
      );
      const trailingSpace = result.length - beforeDot.length;

      i++;
      let methodStart = i;
      while (i < source.length && (isAlpha(source[i]) || source[i] === "_")) {
        i++;
      }
      const methodName = source.substring(methodStart, i);
      if (methodName === "") {
        result += ".";
        i = methodStart;
        continue;
      }
      i = skipWhitespace(source, i);
      if (i < source.length && source[i] === "(") {
        const argsEnd = matchParenDepth(source, i, "(");
        const args = source.substring(i + 1, argsEnd);
        const padding = " ".repeat(trailingSpace);
        const call =
          args.trim() === ""
            ? `${methodName}(${receiver})`
            : `${methodName}(${receiver}, ${args})`;
        result = beforeReceiver + padding + call;
        i = argsEnd + 1;
        continue;
      }
      result += ".";
      i = methodStart;
    } else {
      result += source[i];
      i++;
    }
  }
  return result;
}

function extractReceiver(beforeDot: string): string | null {
  let j = beforeDot.length - 1;

  if (beforeDot[j] === ")") {
    let depth = 1;
    j--;
    while (j >= 0 && depth > 0) {
      if (beforeDot[j] === ")") depth++;
      else if (beforeDot[j] === "(") depth--;
      j--;
    }
    return beforeDot.substring(j + 1);
  }

  if (beforeDot[j] === "]") {
    let depth = 1;
    j--;
    while (j >= 0 && depth > 0) {
      if (beforeDot[j] === "]") depth++;
      else if (beforeDot[j] === "[") depth--;
      j--;
    }
    return beforeDot.substring(j + 1);
  }

  const start = j;
  while (
    j >= 0 &&
    (isAlpha(beforeDot[j]) || isDigit(beforeDot[j]) || beforeDot[j] === "_")
  ) {
    j--;
  }

  return j === start ? null : beforeDot.substring(j + 1);
}

function isValidReceiver(beforeDot: string): boolean {
  if (beforeDot.length === 0) return false;
  const lastChar = beforeDot[beforeDot.length - 1];
  return lastChar === ")" || lastChar === "]" || isDigit(lastChar);
}

function isAlpha(char: string): boolean {
  const code = char.charCodeAt(0);
  return (code >= 97 && code <= 122) || (code >= 65 && code <= 90);
}

function isDigit(char: string): boolean {
  return char >= "0" && char <= "9";
}

export { transformMethodCalls };
