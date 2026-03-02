function extractBinaryOperands(
  source: string,
  opIndex: number,
  opLen: number,
): { leftExpr: string; rightExpr: string } | null {
  let leftEnd = opIndex - 1;
  while (leftEnd >= 0 && source[leftEnd] === " ") {
    leftEnd--;
  }
  if (leftEnd < 0) {
    return null;
  }
  let leftStart = leftEnd;
  while (
    leftStart >= 0 &&
    source[leftStart] !== " " &&
    source[leftStart] !== ";" &&
    source[leftStart] !== "{" &&
    source[leftStart] !== "("
  ) {
    leftStart--;
  }
  leftStart++;
  const leftExpr = source.substring(leftStart, leftEnd + 1).trim();
  let rightStart = opIndex + opLen;
  while (rightStart < source.length && source[rightStart] === " ") {
    rightStart++;
  }
  if (rightStart >= source.length) {
    return null;
  }
  let rightEnd = rightStart;
  while (
    rightEnd < source.length &&
    source[rightEnd] !== " " &&
    source[rightEnd] !== ";" &&
    source[rightEnd] !== "}" &&
    source[rightEnd] !== ")"
  ) {
    rightEnd++;
  }
  const rightExpr = source.substring(rightStart, rightEnd).trim();
  if (leftExpr === "" || rightExpr === "") {
    return null;
  }
  return { leftExpr, rightExpr };
}

export { extractBinaryOperands };
