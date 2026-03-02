function skipGenericParameters(source: string, i: number): number {
  if (source[i] !== "<") return i;
  let depth = 0;
  let j = i;
  while (j < source.length) {
    if (source[j] === "<") depth++;
    else if (source[j] === ">") {
      depth--;
      if (depth === 0) return j + 1;
    }
    j++;
  }
  return i;
}
export { skipGenericParameters };
