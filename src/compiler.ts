export interface CompileResult {
  output: string;
  diagnostics: string[];
}

export function compile(source: string): CompileResult {
  return {
    output: source,
    diagnostics: [],
  };
}
