import {
  VariableInfo,
  Result,
  CompileError,
  err,
  createCompileError,
} from "./types";
import { extractIdentifier } from "./extractors";
import { splitStatementsKeepBlocks } from "./metadata";
import { validateReassignment } from "./validators-type-checks";

function checkReassignments(
  source: string,
  metadata: VariableInfo[],
): Result<void, CompileError> {
  const statements = splitStatementsKeepBlocks(source);
  let si = 0;
  while (si < statements.length) {
    const stmt = statements[si];
    if (stmt.substring(0, 4) === "let ") {
      si++;
      continue;
    }
    const eqIndex = stmt.indexOf("=");
    if (eqIndex === -1) {
      si++;
      continue;
    }
    const beforeEq = stmt.substring(0, eqIndex).trim();
    const identifier = extractIdentifier(beforeEq, 0);
    if (identifier !== beforeEq) {
      si++;
      continue;
    }
    let metaVar: VariableInfo | null = null;
    let mi = 0;
    while (mi < metadata.length) {
      if (metadata[mi].name === identifier) {
        metaVar = metadata[mi];
        break;
      }
      mi++;
    }
    if (metaVar === null) {
      return err(
        createCompileError(
          stmt,
          `Cannot reassign undefined variable: '${identifier}'`,
          "Variable must be declared before reassignment",
          `Add a declaration: 'let mut ${identifier} = ...'`,
        ),
      );
    }
    const validRes = validateReassignment(stmt, identifier, metaVar);
    if (validRes.type === "err") return validRes;
    si++;
  }
  return { type: "ok", value: void 0 };
}

export { checkReassignments };
