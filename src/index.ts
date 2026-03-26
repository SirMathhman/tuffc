import * as ts from "typescript";

export function greet(name: string): string {
  return `Hello, ${name}!`;
}

export function compileTuffToTS(source: string): string {
  void source;
  return "";
}

export function evaluateTuff(tuffSource: string): number {
  const tsSource = compileTuffToTS(tuffSource);

  try {
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
  } catch {
    // Fall through to the guaranteed numeric return below.
  }

  return 0;
}

if (import.meta.main) {
  const name = process.argv[2] ?? "world";
  console.log(greet(name));
}
