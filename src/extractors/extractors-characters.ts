function isDigit(c: string): boolean {
  return c >= "0" && c <= "9";
}

function isAlpha(c: string): boolean {
  return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");
}

function isAlphaNumeric(c: string): boolean {
  return isAlpha(c) || isDigit(c) || c === "_";
}

function isWordStart(source: string, i: number): boolean {
  return i === 0 || !isAlphaNumeric(source[i - 1]);
}

export { isDigit, isAlpha, isAlphaNumeric, isWordStart };
