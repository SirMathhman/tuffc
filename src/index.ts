export function compile(source: string): string {
  const trimmed = source.trim();
  
  if (trimmed === "") {
    return "0";
  }
  
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }
  
  return "0";
}
