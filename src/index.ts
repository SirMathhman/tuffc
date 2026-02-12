export class CompileError extends Error {
  // Code snippet of what was invalid, should ideally be a few lines of code to give context to the error.
  erroneousCode: string;

  // Reason why this is an error. Discuss the syntax more generally, and why the language is designed in this particular way.
  reason: string;

  // A suggested fix for this.
  fix: string;

  constructor(message: string, erroneousCode: string, reason: string, fix: string) {
    super(message);
    this.erroneousCode = erroneousCode;
    this.reason = reason;
    this.fix = fix;
  }
}

export function compileTuffToC(source: string): string {
  throw new CompileError("Not implemented yet", "?", "?", "?");
}
