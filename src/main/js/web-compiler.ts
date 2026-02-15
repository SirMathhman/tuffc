// @ts-nocheck
import { lex } from "./lexer.ts";
import { parse } from "./parser.ts";
import { desugar } from "./desugar.ts";
import { resolveNames } from "./resolve.ts";
import { typecheck } from "./typecheck.ts";
import { generateJavaScript } from "./codegen-js.ts";
import { enrichError, toDiagnostic, TuffError } from "./errors.ts";
import { err, ok, type Result } from "./result.ts";

type CompileOutput = {
  js: string;
  lintIssues: unknown[];
};

type CompileOptions = {
  filePath?: string;
  typecheck?: { strictSafety?: boolean };
  resolve?: { hostBuiltins?: string[]; allowHostPrefix?: string };
  lint?: {
    enabled?: boolean;
    mode?: "error" | "warn";
    maxEffectiveLines?: number;
  };
};

export function compileTuffToJsResult(
  source: string,
  options: CompileOptions = {},
): Result<CompileOutput, TuffError> {
  const filePath = options.filePath ?? "<memory>";

  const tokensResult = lex(source, filePath);
  if (!tokensResult.ok) {
    enrichError(tokensResult.error, { source });
    return tokensResult;
  }

  const cstResult = parse(tokensResult.value);
  if (!cstResult.ok) {
    enrichError(cstResult.error, { source });
    return cstResult;
  }

  const core = desugar(cstResult.value);

  const resolveResult = resolveNames(core, options.resolve ?? {});
  if (!resolveResult.ok) {
    enrichError(resolveResult.error, { source });
    return resolveResult;
  }

  const typecheckResult = typecheck(core, options.typecheck ?? {});
  if (!typecheckResult.ok) {
    enrichError(typecheckResult.error, { source });
    return typecheckResult;
  }

  const lintIssues = [];

  return ok({
    js: generateJavaScript(core),
    lintIssues,
  });
}

export function compileTuffToJs(
  source: string,
  options: CompileOptions = {},
): string {
  const result = compileTuffToJsResult(source, options);
  if (!result.ok) {
    throw result.error;
  }
  return result.value.js;
}

export function compileTuffToJsDiagnostics(
  source: string,
  options: CompileOptions = {},
):
  | {
      ok: true;
      js: string;
      lintDiagnostics: ReturnType<typeof toDiagnostic>[];
    }
  | {
      ok: false;
      error: ReturnType<typeof toDiagnostic>;
    } {
  const result = compileTuffToJsResult(source, options);
  if (!result.ok) {
    return {
      ok: false,
      error: toDiagnostic(result.error),
    };
  }

  return {
    ok: true,
    js: result.value.js,
    lintDiagnostics: result.value.lintIssues.map((issue) =>
      toDiagnostic(issue),
    ),
  };
}
