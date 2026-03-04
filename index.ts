export function compile(source: string): string {
  // Remove type annotations like <U8>, <I32>, etc. without using regex
  let transformed = "";
  let i = 0;
  while (i < source.length) {
    if (source[i] === "<") {
      // Skip until closing >
      while (i < source.length && source[i] !== ">") {
        i++;
      }
      i++; // skip the closing >
    } else {
      transformed += source[i];
      i++;
    }
  }
  // Wrap in a return statement
  return `return ${transformed};`;
}
