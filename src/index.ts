export function compileTuffToTS(tuffSource: string): string {
  if (tuffSource === "") {
    return "return 0;";
  }

  const letBindingMatch = /^let ([a-zA-Z_][a-zA-Z0-9_]*) : U8 = (.+); \1$/.exec(
    tuffSource,
  );
  if (letBindingMatch) {
    const compiledInitializer = compileTuffToTS(letBindingMatch[2]);
    const initializerMatch = /^return (.+);$/.exec(compiledInitializer);
    if (initializerMatch) {
      return `const ${letBindingMatch[1]} = ${initializerMatch[1]}; return ${letBindingMatch[1]};`;
    }
  }

  const u8AdditionMatch = /^([0-9]+)U8 \+ ([0-9]+)U8$/.exec(tuffSource);
  if (u8AdditionMatch) {
    return `return ${u8AdditionMatch[1]} + ${u8AdditionMatch[2]};`;
  }

  const u8LiteralMatch = /^([0-9]+)U8$/.exec(tuffSource);
  if (u8LiteralMatch) {
    return `return ${u8LiteralMatch[1]};`;
  }

  return "";
}

export function compileTSToTuff(tsSource: string): string {
  if (tsSource.trim() === "return 0;") {
    return "";
  }

  const letBindingReturnMatch =
    /^const ([a-zA-Z_][a-zA-Z0-9_]*) = (.+); return \1;$/.exec(tsSource.trim());
  if (letBindingReturnMatch) {
    const initializerTuff = compileTSToTuff(
      `return ${letBindingReturnMatch[2]};`,
    );
    if (initializerTuff !== "") {
      return `let ${letBindingReturnMatch[1]} : U8 = ${initializerTuff}; ${letBindingReturnMatch[1]}`;
    }
  }

  const returnAdditionMatch = /^return ([0-9]+) \+ ([0-9]+);$/.exec(
    tsSource.trim(),
  );
  if (returnAdditionMatch) {
    return `${returnAdditionMatch[1]}U8 + ${returnAdditionMatch[2]}U8`;
  }

  const returnLiteralMatch = /^return ([0-9]+);$/.exec(tsSource.trim());
  if (returnLiteralMatch) {
    return `${returnLiteralMatch[1]}U8`;
  }

  return "";
}
