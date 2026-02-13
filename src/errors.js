export class TuffError extends Error {
  constructor(message, loc = null) {
    super(loc ? `${message} @ ${loc.line}:${loc.column}` : message);
    this.name = "TuffError";
    this.loc = loc;
  }
}

export function assert(condition, message, loc) {
  if (!condition) {
    throw new TuffError(message, loc);
  }
}
