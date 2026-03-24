export function compileTuffToTS(tuffSource: string): string {
  if (tuffSource === "") {
    return "return 0;";
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

  const returnLiteralMatch = /^return ([0-9]+);$/.exec(tsSource.trim());
  if (returnLiteralMatch) {
    return `${returnLiteralMatch[1]}U8`;
  }

  return "";
}
