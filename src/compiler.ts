import { checkProgram } from "./checker";
import { generateProgram } from "./codegen";
import type { Diagnostic } from "./diagnostics";
import { lex } from "./lexer";
import { parseTokens } from "./parser";

export interface CompileResult {
  output: string;
  diagnostics: Diagnostic[];
}

export function compile(source: string): CompileResult {
  const lexResult = lex(source);
  if (lexResult.diagnostics.length > 0) {
    return { output: "", diagnostics: lexResult.diagnostics };
  }

  const parseResult = parseTokens(lexResult.tokens);
  if (parseResult.diagnostics.length > 0 || parseResult.program === undefined) {
    return { output: "", diagnostics: parseResult.diagnostics };
  }

  const checkResult = checkProgram(parseResult.program);
  if (checkResult.diagnostics.length > 0) {
    return { output: "", diagnostics: checkResult.diagnostics };
  }

  return { output: generateProgram(parseResult.program, checkResult.functions), diagnostics: [] };
}
