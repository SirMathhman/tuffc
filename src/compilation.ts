import {
  Result,
  CompileError,
  VariableInfo,
  ok,
  err,
  createCompileError,
} from "./types";
import {
  validateTypeSuffix,
  checkReassignments,
  checkVariableDuplicates,
  checkAssignmentTypeMatch,
  checkUndefinedVariables,
  checkBlockScopes,
  checkBlockExpressions,
  checkPointerOperators,
} from "./validators";
import {
  extractNumericPart,
  extractReadType,
  extractBlockAndAfter,
} from "./extractors";
import { buildVariableMetadata } from "./metadata";
import {
  wrapBlockExpressionInInit,
  stripTypeAnnotations,
  transformReadPatterns,
  transformAddressOf,
  transformDereference,
  stripNumericTypeSuffixes,
} from "./transformations";

function parseNumberLiteral(trimmed: string): Result<string, CompileError> {
  let num = Number(trimmed);
  if (!Number.isNaN(num) && String(num) === trimmed) {
    return ok(trimmed);
  }

  const isNegative = trimmed[0] === "-";
  let numericStart: number;
  if (isNegative) {
    numericStart = 1;
  } else {
    numericStart = 0;
  }

  const { numericPart, endIndex } = extractNumericPart(trimmed, numericStart);

  if (numericPart !== "") {
    num = Number(numericPart);
    if (!Number.isNaN(num)) {
      const hasSuffix = endIndex < trimmed.length;

      if (isNegative && hasSuffix) {
        return err(
          createCompileError(
            trimmed,
            "Negative numbers with type suffixes are not allowed",
            "Type suffixes are only valid for positive literal values",
            "Remove the type suffix from the negative number, or remove the minus sign if the value should be positive",
          ),
        );
      }

      if (hasSuffix) {
        const suffix = trimmed.slice(endIndex);
        const validationResult = validateTypeSuffix(suffix, num, trimmed);
        if (validationResult.type === "err") {
          return validationResult;
        }
      }

      return ok(numericPart);
    }
  }

  return err(
    createCompileError(
      trimmed,
      `Cannot parse as a number: '${trimmed}'`,
      "Expected a valid numeric literal (e.g., '42', '-100', '255U8')",
      `Provide a valid number or use a variable declaration (let x = ${trimmed};)`,
    ),
  );
}

function generateFunctionFromLastStatement(
  beforeLastStatement: string,
  lastStatement: string,
): string {
  const { block, after } = extractBlockAndAfter(lastStatement);
  if (block !== null) {
    let returnVal: string;
    if (after === "") {
      returnVal = "0";
    } else {
      returnVal = after;
    }
    return `(function() { ${beforeLastStatement} ${block} return ${returnVal}; })()`;
  }
  if (lastStatement.startsWith("{}")) {
    const afterBlock = lastStatement.substring(2).trim();
    let returnVal: string;
    if (afterBlock === "") {
      returnVal = "0";
    } else {
      returnVal = afterBlock;
    }
    return `(function() { ${beforeLastStatement} return ${returnVal}; })()`;
  }
  return `(function() { ${beforeLastStatement} return ${lastStatement}; })()`;
}

function verifyLetStatement(
  source: string,
  metadata: VariableInfo[],
): Result<void, CompileError> {
  const dupRes = checkVariableDuplicates(metadata);
  if (dupRes.type === "err") return dupRes;

  let i = 0;
  while (i < metadata.length) {
    const varInfo = metadata[i];
    if (varInfo.stmt.indexOf("read<") !== -1) {
      const readType = extractReadType(varInfo.stmt);
      if (
        varInfo.declaredType !== "" &&
        readType !== "" &&
        varInfo.declaredType !== readType
      ) {
        return err(
          createCompileError(
            varInfo.stmt,
            `Type mismatch: declared variable as '${varInfo.declaredType}' but initialized with 'read<${readType}>()'`,
            "Variable declaration type must match the type of the read operation",
            `Change either the declared type to '${readType}' or the read type to '<${varInfo.declaredType}>'`,
          ),
        );
      }
    }
    i++;
  }

  const assignRes = checkAssignmentTypeMatch(metadata);
  if (assignRes.type === "err") return assignRes;

  const ptrRes = checkPointerOperators(source, metadata);
  if (ptrRes.type === "err") return ptrRes;

  const undefRes = checkUndefinedVariables(source, metadata);
  if (undefRes.type === "err") return undefRes;

  const reassignRes = checkReassignments(source, metadata);
  if (reassignRes.type === "err") return reassignRes;

  return ok(void 0);
}

function compileLetStatement(
  source: string,
): Result<string, CompileError> | null {
  const trimmed = source.trim();
  if (trimmed.indexOf("let ") === -1) {
    return null;
  }
  const processedSource = wrapBlockExpressionInInit(trimmed);
  const metadata = buildVariableMetadata(processedSource);
  const verRes = verifyLetStatement(processedSource, metadata);
  if (verRes.type === "err") return verRes;
  const code = stripNumericTypeSuffixes(
    transformDereference(
      transformAddressOf(
        stripTypeAnnotations(transformReadPatterns(processedSource)),
      ),
    ),
  );
  let braceDepth = 0;
  let lastSemicolonIndex = -1;
  let i = 0;
  while (i < code.length) {
    if (code[i] === "{") {
      braceDepth++;
    } else if (code[i] === "}") {
      braceDepth--;
    } else if (code[i] === ";" && braceDepth === 0) {
      lastSemicolonIndex = i;
    }
    i++;
  }
  if (lastSemicolonIndex === -1) {
    return ok(`(function() { return ${code}; })()`);
  }
  const beforeLastStatement = code.substring(0, lastSemicolonIndex + 1);
  const lastStatement = code.substring(lastSemicolonIndex + 1).trim();
  if (lastStatement === "") {
    return ok(`(function() { ${code} return 0; })()`);
  }
  const generatedCode = generateFunctionFromLastStatement(
    beforeLastStatement,
    lastStatement,
  );
  return ok(generatedCode);
}

export function compile(source: string): Result<string, CompileError> {
  const trimmed = source.trim();

  if (trimmed === "") {
    return ok("0");
  }

  const blockScopeRes = checkBlockScopes(source);
  if (blockScopeRes !== null) {
    return blockScopeRes;
  }

  const blockExprRes = checkBlockExpressions(source);
  if (blockExprRes !== null) {
    return blockExprRes;
  }

  const letRes = compileLetStatement(source);
  if (letRes !== null) {
    return letRes;
  }

  if (trimmed.indexOf("read<") !== -1) {
    const emptyMetadata: VariableInfo[] = [];
    const reassignRes = checkReassignments(trimmed, emptyMetadata);
    if (reassignRes.type === "err") {
      return reassignRes;
    }
    return ok(transformReadPatterns(trimmed));
  }

  if (trimmed.startsWith("{}")) {
    const afterBlock = trimmed.substring(2).trim();
    if (afterBlock !== "") {
      return compile(afterBlock);
    }
    return ok("0");
  }

  const undefCheckResult = checkUndefinedVariables(trimmed, []);
  if (undefCheckResult.type === "err") {
    return undefCheckResult;
  }

  return parseNumberLiteral(trimmed);
}
