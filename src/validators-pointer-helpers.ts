import { Result, CompileError, ok, err, createCompileError } from "./types";
import { extractIdentifier, advancePast } from "./extractors";
import { splitStatementsKeepBlocks } from "./metadata";

function undeclaredVariableError(
  source: string,
  varName: string,
  context: string,
  hint: string,
): Result<void, CompileError> {
  return err(
    createCompileError(
      source,
      `Undefined variable: '${varName}' ${context}`,
      "All variables must be declared with 'let' before they can be used",
      hint,
    ),
  );
}

function varNotDeclaredHint(varName: string, usage: string): string {
  return `Declare '${varName}' using 'let ${varName}${usage}' before using it`;
}

function checkOperatorUsage(
  source: string,
  operator: string,
  checker: (_varName: string) => Result<void, unknown>,
  skipTypeAnnotation: boolean,
  prefixAfterOperator?: string,
): Result<void, unknown> {
  const statements = splitStatementsKeepBlocks(source);
  let stmtIdx = 0;
  while (stmtIdx < statements.length) {
    const stmt = statements[stmtIdx];
    let startCheck = 0;
    if (skipTypeAnnotation && stmt.substring(0, 4) === "let ") {
      const eqIndex = stmt.indexOf("=");
      if (eqIndex !== -1) {
        startCheck = eqIndex + 1;
      }
    }
    let i = startCheck;
    while (i < stmt.length) {
      if (stmt[i] === operator) {
        let varStart = i + 1;
        if (
          prefixAfterOperator !== undefined &&
          stmt.substring(i + 1, i + 1 + prefixAfterOperator.length) ===
            prefixAfterOperator
        ) {
          varStart = i + 1 + prefixAfterOperator.length;
        }
        const varName = extractIdentifier(stmt, varStart);
        if (varName !== "") {
          const checkRes = checker(varName);
          if (checkRes.type === "err") return checkRes;
          i = advancePast(varStart, varName);
        } else {
          i++;
        }
      } else {
        i++;
      }
    }
    stmtIdx++;
  }
  return ok(void 0);
}

export { undeclaredVariableError, varNotDeclaredHint, checkOperatorUsage };
