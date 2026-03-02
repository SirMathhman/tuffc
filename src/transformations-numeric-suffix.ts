import { isDigit, isAlpha } from "./extractors";

function extractNumericIfPresent(
  source: string,
  i: number,
): { newIndex: number; result: string } {
  const isNumber =
    isDigit(source[i]) ||
    (source[i] === "-" && i + 1 < source.length && isDigit(source[i + 1]));
  if (!isNumber) {
    return { newIndex: i, result: "" };
  }
  let j = i;
  if (source[j] === "-") j++;
  while (j < source.length && isDigit(source[j])) {
    j++;
  }
  const numericPart = source.substring(i, j);
  let suffixEnd = j;
  while (suffixEnd < source.length && isAlpha(source[suffixEnd])) {
    suffixEnd++;
  }
  return { newIndex: suffixEnd, result: numericPart };
}

export { extractNumericIfPresent };
