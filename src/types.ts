interface Ok<T> {
  type: "ok";
  value: T;
}

interface Err<E> {
  type: "err";
  error: E;
}

interface CompileError {
  code: string;
  message: string;
  reason: string;
  fix: string;
}

type Result<T, E> = Ok<T> | Err<E>;

function ok<T, E>(value: T): Result<T, E> {
  return { type: "ok", value };
}

function err<T, E>(error: E): Result<T, E> {
  return { type: "err", error };
}

function createCompileError(
  code: string,
  message: string,
  reason: string,
  fix: string,
): CompileError {
  return { code, message, reason, fix };
}

interface VariableInfo {
  name: string;
  declaredType: string;
  inferredType: string;
  isMutable: boolean;
  stmt: string;
}

interface DereferenceAssignment {
  varName: string;
  position: number;
  exprStart: number;
  exprEnd: number;
}

type OperatorChecker = (
  _varName: string,
  _varInfo: VariableInfo | undefined,
  _source: string,
) => Result<void, CompileError>;

export {
  Ok,
  Err,
  CompileError,
  Result,
  ok,
  err,
  createCompileError,
  VariableInfo,
  DereferenceAssignment,
  OperatorChecker,
};
