export interface Diagnostic {
  message: string;
  line: number;
  column: number;
}

export function createDiagnostic(message: string, line: number, column: number): Diagnostic {
  return { message, line, column };
}