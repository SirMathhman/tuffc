export function compile(source: string): string {
  const trimmed = source.trim();

  if (trimmed === "") {
    return "0";
  }

  const num = Number(trimmed);
  if (!Number.isNaN(num) && String(num) === trimmed) {
    return trimmed;
  }

  return "0";
}
