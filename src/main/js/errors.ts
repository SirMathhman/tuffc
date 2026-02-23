// @ts-nocheck
import { err, ok, type Result } from "./result.ts";

export class TuffError extends Error {
  constructor(
    message: string,
    loc:
      | { line?: number; column?: number; filePath?: string }
      | undefined = undefined,
    options: Record<string, unknown> = {},
  ) {
    const code = options.code ?? "E_GENERIC";
    super(
      loc
        ? `[${code}] ${message} @ ${loc.line}:${loc.column}`
        : `[${code}] ${message}`,
    );
    this.name = "TuffError";
    this.code = code;
    this.loc = loc;
    this.causeMessage = message;
    this.source = options.source ?? undefined;
    this.reason = options.reason ?? options.details ?? undefined;
    this.fix = options.fix ?? options.hint ?? undefined;
    // Backward compatibility with existing diagnostics/tests.
    this.hint = this.fix;
    this.details = this.reason;
  }
}

function getLine(source, lineNumber) {
  if (!source || lineNumber == undefined || lineNumber < 1) return undefined;
  const lines = source.split(/\r?\n/);
  return lines[lineNumber - 1] ?? undefined;
}

function createSourceExcerpt(source, loc) {
  if (!source) return undefined;
  if (!loc?.line) {
    return source;
  }
  const lineText = getLine(source, loc.line);
  if (lineText == undefined) return undefined;

  const col = Math.max(1, Number(loc.column ?? 1));
  const caretPad = " ".repeat(Math.max(0, col - 1));
  return `${lineText}\n${caretPad}^`;
}

export function enrichError(
  error: unknown,
  context: {
    sourceByFile?: Map<string, string>;
    source?: string | undefined;
    filePath?: string | undefined;
  } = {},
): unknown {
  if (!(error instanceof TuffError)) return error;

  if (!error.loc?.filePath && context.filePath) {
    error.loc = {
      ...(error.loc ?? {}),
      filePath: context.filePath,
    };
  }

  if (error.source) return error;

  const filePath = error.loc?.filePath;
  const fromMap =
    filePath && context.sourceByFile instanceof Map
      ? context.sourceByFile.get(filePath)
      : undefined;
  const source = fromMap ?? context.source ?? undefined;
  error.source = createSourceExcerpt(source, error.loc);
  return error;
}

export function assert<T>(
  condition: boolean,
  message: string,
  loc: unknown,
  options: Record<string, unknown> = {},
): Result<true, TuffError> {
  if (!condition) {
    return err(new TuffError(message, loc, options));
  }
  return ok(true);
}

export function toDiagnostic(error: unknown): {
  kind: string;
  code: string;
  message: string;
  source: string;
  cause: string;
  reason: string;
  fix: string;
  hint: string | undefined;
  details: string | undefined;
  loc: unknown;
  stack: string | undefined;
} {
  const isTuff = error instanceof TuffError;
  const fallbackReason =
    "This violates the language rules or safety guarantees enforced by the compiler.";
  const fallbackFix =
    "Update the code near this location so it satisfies the expected syntax, typing, and safety constraints.";
  return {
    kind: isTuff ? "tuff" : "unknown",
    code: isTuff ? error.code : "E_UNKNOWN",
    message: isTuff ? error.causeMessage : (error?.message ?? String(error)),
    source: isTuff ? (error.source ?? "<unavailable>") : "<unavailable>",
    cause: isTuff ? error.causeMessage : (error?.message ?? String(error)),
    reason: isTuff ? (error.reason ?? fallbackReason) : fallbackReason,
    fix: isTuff ? (error.fix ?? fallbackFix) : fallbackFix,
    hint: isTuff ? error.hint : undefined,
    details: isTuff ? error.details : undefined,
    loc: isTuff ? error.loc : undefined,
    stack: error?.stack ?? undefined,
  };
}

export function formatDiagnostic(
  diag: {
    loc?: { filePath?: string; line?: number; column?: number } | undefined;
    source?: string | undefined;
    cause?: string | undefined;
    message?: string | undefined;
    reason?: string | undefined;
    fix?: string | undefined;
    code?: string;
  },
  useColor = false,
): string {
  const c = (text: string, ansi: number) =>
    useColor ? `\u001b[${ansi}m${text}\u001b[0m` : text;
  const bold = (t: string) => c(t, 1);
  const red = (t: string) => c(t, 31);
  const boldRed = (t: string) => (useColor ? `\u001b[1;31m${t}\u001b[0m` : t);
  const cyan = (t: string) => c(t, 36);
  const yellow = (t: string) => c(t, 33);
  const dim = (t: string) => c(t, 2);

  const where = diag.loc
    ? `${diag.loc.filePath ?? "<memory>"}:${diag.loc.line}:${diag.loc.column}`
    : "<unknown>";

  // Highlight the caret line within the source excerpt
  const rawSource = diag.source ?? "<unavailable>";
  const coloredSource = useColor
    ? rawSource.replace(/^(\s*)\^/m, (_m, pad) => pad + boldRed("^"))
    : rawSource;

  const lines = [
    boldRed(`error[${diag.code}]`) +
      " " +
      bold(diag.cause ?? diag.message ?? "<unknown>"),
    "  " + dim("-->") + " " + bold(where),
    "  " + cyan("source:"),
    `    ${coloredSource.replaceAll("\n", "\n    ")}`,
    "  " + cyan("reason:"),
    `    ${diag.reason ?? "This violates the language rules or safety guarantees."}`,
    "  " + yellow("fix:"),
    `    ${diag.fix ?? "Adjust the code at this location to satisfy the expected syntax/type/safety contract."}`,
  ];
  return lines.join("\n");
}
