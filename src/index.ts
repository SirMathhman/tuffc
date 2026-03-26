import * as ts from "typescript";

const SIGNED_U8_LITERAL = /^\s*([+-])?(\d+)U8\s*$/;

export function greet(name: string): string {
  return `Hello, ${name}!`;
}

export function compileTuffToTS(source: string): string {
  const match = SIGNED_U8_LITERAL.exec(source);

  if (!match) {
    throw new SyntaxError("Unsupported Tuff source.");
  }

  if (match[1] !== undefined) {
    throw new RangeError("Unsigned integer literals cannot be signed.");
  }

  const value = Number(match[2]);

  if (!Number.isSafeInteger(value) || value < 0 || value > 255) {
    throw new RangeError("U8 literals must be between 0 and 255.");
  }

  return `export default ${value};`;
}

export function evaluateTuff(tuffSource: string): number {
  const tsSource = compileTuffToTS(tuffSource);
  const jsSource = ts.transpileModule(tsSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const module = { exports: {} as unknown };
  const executionResult = new Function(
    "module",
    "exports",
    `${jsSource}\nreturn module.exports;`,
  )(module, module.exports);

  const possibleValues = [executionResult, module.exports];

  for (const value of possibleValues) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (
      value !== null &&
      typeof value === "object" &&
      "default" in value &&
      typeof (value as { default: unknown }).default === "number" &&
      Number.isFinite((value as { default: number }).default)
    ) {
      return (value as { default: number }).default;
    }
  }

  throw new TypeError(
    "evaluateTuff expected compiled code to produce a number.",
  );
}

if (import.meta.main) {
  const name = process.argv[2] ?? "world";
  console.log(greet(name));
}
