function transformReadPatterns(source: string): string {
  let result = "";
  let i = 0;
  while (i < source.length) {
    let consumed = 1;
    if (source.substring(i, i + 5) === "read<") {
      let j = i + 5;
      while (j < source.length && source[j] !== ">") {
        j++;
      }
      if (source[j] === ">" && source[j + 1] === "(" && source[j + 2] === ")") {
        result += "read()";
        consumed = j + 3 - i;
      }
    }
    if (consumed === 1) {
      if (source.substring(i, i + 4) === "true") {
        result += "1";
        consumed = 4;
      } else if (source.substring(i, i + 5) === "false") {
        result += "0";
        consumed = 5;
      } else {
        result += source[i];
      }
    }
    i += consumed;
  }
  return result;
}

export { transformReadPatterns };
