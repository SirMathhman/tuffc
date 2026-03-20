console.log("Hello via Bun!");

type TuffType =
  | "U8"
  | "U16"
  | "U32"
  | "U64"
  | "I8"
  | "I16"
  | "I32"
  | "I64"
  | null;

const bounds: Record<Exclude<TuffType, null>, [number, number]> = {
  U8: [0, 0xff],
  U16: [0, 0xffff],
  U32: [0, 0xffffffff],
  U64: [0, Number.MAX_SAFE_INTEGER],
  I8: [-0x80, 0x7f],
  I16: [-0x8000, 0x7fff],
  I32: [-0x80000000, 0x7fffffff],
  I64: [-Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
};

const unsignedOrder: Array<Exclude<TuffType, null>> = [
  "U8",
  "U16",
  "U32",
  "U64",
];
const signedOrder: Array<Exclude<TuffType, null>> = ["I8", "I16", "I32", "I64"];

function throwInvalid(input: string): never {
  throw new Error(`Invalid Tuff input: ${input}`);
}

function assertRange(
  value: number,
  min: number,
  max: number,
  input: string,
): void {
  if (value < min || value > max) {
    throwInvalid(input);
  }
}

function assertIsNumber(value: number, input: string): void {
  if (Number.isNaN(value)) {
    throwInvalid(input);
  }
}

function validateRange(value: number, type: TuffType, input: string): void {
  if (type === null) {
    return;
  }

  const [min, max] = bounds[type];
  assertRange(value, min, max, input);
}

function promoteType(a: TuffType, b: TuffType): TuffType {
  if (a === null) return b;
  if (b === null) return a;
  if (a === b) return a;

  if (a.startsWith("U") && b.startsWith("U")) {
    const result =
      unsignedOrder[
        Math.max(unsignedOrder.indexOf(a), unsignedOrder.indexOf(b))
      ];
    return result as Exclude<TuffType, null>;
  }

  if (a.startsWith("I") && b.startsWith("I")) {
    const result =
      signedOrder[Math.max(signedOrder.indexOf(a), signedOrder.indexOf(b))];
    return result as Exclude<TuffType, null>;
  }

  const aBounds = bounds[a];
  const bBounds = bounds[b];
  return aBounds[1] >= bBounds[1] ? a : b;
}

function parseLiteral(
  token: string,
  input: string,
): { value: number; type: TuffType } {
  const typedSuffix = /^([+-]?\d+)(U8|U16|U32|U64|I8|I16|I32|I64)$/i;
  const typedMatch = token.match(typedSuffix);
  if (typedMatch) {
    const rawValue = Number(typedMatch[1]);
    const suffix = typedMatch[2]!.toUpperCase() as Exclude<TuffType, null>;

    validateRange(rawValue, suffix, input);
    return { value: rawValue, type: suffix };
  }

  const value = Number(token);
  assertIsNumber(value, input);
  return { value, type: null };
}

function consumeNumericToken(
  input: string,
  start: number,
): { token: string; next: number } {
  let j = start;
  if (input[j] === "+" || input[j] === "-") {
    j++;
  }

  const digitStart = j;
  while (j < input.length && /\d/.test(input.charAt(j))) {
    j++;
  }
  if (j === digitStart) {
    throwInvalid(input);
  }

  const suffixMatch = input.slice(j).match(/^(U8|U16|U32|U64|I8|I16|I32|I64)/i);
  if (suffixMatch) {
    j += suffixMatch[0].length;
  }

  return { token: input.slice(start, j), next: j };
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input.charAt(i);

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    const previous = tokens[tokens.length - 1];
    const isUnarySign =
      (ch === "+" || ch === "-") && (!previous || /^[+\-*/(]$/.test(previous));

    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      if (isUnarySign) {
        const { token, next } = consumeNumericToken(input, i);
        tokens.push(token);
        i = next;
        continue;
      }

      tokens.push(ch);
      i++;
      continue;
    }

    if (ch === "(" || ch === ")") {
      tokens.push(ch);
      i++;
      continue;
    }

    if (/\d/.test(ch)) {
      const { token, next } = consumeNumericToken(input, i);
      tokens.push(token);
      i = next;
      continue;
    }

    throwInvalid(input);
  }

  return tokens;
}

function ensureTokens(tokens: string[], input: string): void {
  if (tokens.length === 0) {
    throwInvalid(input);
  }
}

function getPrecedence(): Record<string, number> {
  return { "+": 1, "-": 1, "*": 2, "/": 2 };
}

function evaluateTuff(input: string): { value: number; type: TuffType } {
  const trimmed = input.trim();
  if (trimmed === "") {
    return { value: 0, type: null };
  }

  const tokens = tokenize(trimmed);
  ensureTokens(tokens, input);

  const precedence = getPrecedence();
  const outputQueue: string[] = [];
  const opStack: string[] = [];

  for (const token of tokens) {
    if (/^[+\-]?[0-9]/.test(token)) {
      outputQueue.push(token);
    } else if (
      token === "+" ||
      token === "-" ||
      token === "*" ||
      token === "/"
    ) {
      while (opStack.length > 0) {
        const topOp = opStack[opStack.length - 1] as keyof typeof precedence;
        if (topOp === "(") {
          break;
        }

        const topPrec = precedence[topOp];
        const tokenPrec = precedence[token as keyof typeof precedence];

        if (
          topPrec === undefined ||
          tokenPrec === undefined ||
          topPrec < tokenPrec
        ) {
          break;
        }

        outputQueue.push(opStack.pop()!);
      }
      opStack.push(token);
    } else if (token === "(") {
      opStack.push(token);
    } else if (token === ")") {
      while (opStack.length > 0 && opStack[opStack.length - 1] !== "(") {
        outputQueue.push(opStack.pop()!);
      }
      if (opStack.length === 0 || opStack.pop() !== "(") {
        throw new Error(`Invalid Tuff input: ${input}`);
      }
    }
  }

  while (opStack.length > 0) {
    const op = opStack.pop()!;
    if (op === "(" || op === ")") {
      throw new Error(`Invalid Tuff input: ${input}`);
    }
    outputQueue.push(op);
  }

  const evalStack: Array<{ value: number; type: TuffType }> = [];
  for (const token of outputQueue) {
    if (/^[+-]?[0-9]/.test(token)) {
      evalStack.push(parseLiteral(token, input));
    } else {
      if (evalStack.length < 2) {
        throw new Error(`Invalid Tuff input: ${input}`);
      }
      const right = evalStack.pop()!;
      const left = evalStack.pop()!;
      let resultValue: number;
      if (token === "+") {
        resultValue = left.value + right.value;
      } else if (token === "-") {
        resultValue = left.value - right.value;
      } else if (token === "*") {
        resultValue = left.value * right.value;
      } else if (token === "/") {
        resultValue = left.value / right.value;
      } else {
        throw new Error(`Invalid Tuff input: ${input}`);
      }
      const resultType = promoteType(left.type, right.type);
      validateRange(resultValue, resultType, input);
      evalStack.push({ value: resultValue, type: resultType });
    }
  }

  if (evalStack.length !== 1) {
    throw new Error(`Invalid Tuff input: ${input}`);
  }

  return evalStack[0]!;
}

export function interpretTuff(input: string): number {
  return evaluateTuff(input).value;
}
