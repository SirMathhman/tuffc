import * as ts from "typescript";

export function compileTuffToTS(tuffSourceCode: string): string {
  // TODO: actual Tuff→TS compiler logic here
  return `(function(): number { return ${tuffSourceCode}; })()`;
}

export function compileTSToJS(tsCode: string): string {
  const { outputText } = ts.transpileModule(tsCode, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.None,
    },
  });
  return outputText;
}
