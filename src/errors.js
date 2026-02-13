export class TuffError extends Error {
  constructor(message, loc = null, options = {}) {
    const code = options.code ?? "E_GENERIC";
    super(
      loc
        ? `[${code}] ${message} @ ${loc.line}:${loc.column}`
        : `[${code}] ${message}`,
    );
    this.name = "TuffError";
    this.code = code;
    this.loc = loc;
    this.hint = options.hint ?? null;
    this.details = options.details ?? null;
  }
}

export function assert(condition, message, loc, options = {}) {
  if (!condition) {
    throw new TuffError(message, loc, options);
  }
}

export function toDiagnostic(error) {
  const isTuff = error instanceof TuffError;
  return {
    kind: isTuff ? "tuff" : "unknown",
    code: isTuff ? error.code : "E_UNKNOWN",
    message: error?.message ?? String(error),
    hint: isTuff ? error.hint : null,
    details: isTuff ? error.details : null,
    loc: isTuff ? error.loc : null,
    stack: error?.stack ?? null,
  };
}

export function formatDiagnostic(diag) {
  const where = diag.loc
    ? `${diag.loc.filePath ?? "<memory>"}:${diag.loc.line}:${diag.loc.column}`
    : "<unknown>";
  const lines = [`${diag.code} ${where}`, `  ${diag.message}`];
  if (diag.hint) lines.push(`  hint: ${diag.hint}`);
  if (diag.details) lines.push(`  details: ${diag.details}`);
  return lines.join("\n");
}
