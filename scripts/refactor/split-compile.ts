import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  Node,
  Project,
  SyntaxKind,
  type NamedNode,
  type SourceFile,
  type Statement,
} from "ts-morph";

type Step = "capture" | "move" | "rearrange" | "all";
type DeclKind = "type" | "value";

interface ImportBuckets {
  value: Set<string>;
  type: Set<string>;
}

interface Entry {
  names: string[];
  primaryName: string;
  kindName: string;
  line: number;
  statement: Statement;
  groupKey: string;
  declKind: DeclKind;
  declarationNodes: Node[];
}

interface ImportBinding {
  moduleSpecifier: string;
  kind: DeclKind;
  declarationKey: string;
}

interface GroupConfig {
  key: string;
  filePath: string;
}

const stepArg = (process.argv[2] ?? "all") as Step;
const sourceSnapshotPath = path.join(
  process.cwd(),
  "scripts",
  "refactor",
  "compile-source.ts",
);
const project = new Project({ tsConfigFilePath: "tsconfig.json" });
const source = project.getSourceFileOrThrow(
  existsSync(sourceSnapshotPath) ? sourceSnapshotPath : "src/compile.ts",
);

const captureOutputPath = path.join(
  process.cwd(),
  "scripts",
  "refactor",
  "compile-top-level.json",
);
const originalCompilePath = path.join(process.cwd(), "src", "compile.ts");
const compilerRootPath = path.join(process.cwd(), "src", "compiler");
const rootFacadePath = path.join(process.cwd(), "src", "compile.ts");

const groupConfigs: GroupConfig[] = [
  { key: "ast", filePath: path.join("src", "compiler", "core", "ast.ts") },
  {
    key: "tokenization",
    filePath: path.join("src", "compiler", "core", "tokenization.ts"),
  },
  {
    key: "project",
    filePath: path.join("src", "compiler", "core", "project.ts"),
  },
  { key: "scope", filePath: path.join("src", "compiler", "core", "scope.ts") },
  {
    key: "semantics",
    filePath: path.join("src", "compiler", "semantics", "type-system.ts"),
  },
  {
    key: "validation",
    filePath: path.join("src", "compiler", "semantics", "validation.ts"),
  },
  {
    key: "parser",
    filePath: path.join("src", "compiler", "parser", "index.ts"),
  },
  {
    key: "codegen",
    filePath: path.join("src", "compiler", "codegen", "index.ts"),
  },
  { key: "compiler", filePath: path.join("src", "compiler", "index.ts") },
];

const tokenizationNames = new Set([
  "VALID_TYPES",
  "isWhitespace",
  "isDigit",
  "isLetter",
  "isPrimitiveNumericType",
  "areTypesCompatible",
  "readEscapedCharValue",
  "tokenizeCharLiteral",
  "tokenizeStringLiteral",
  "validateType",
  "tokenize",
]);

const projectNames = new Set([
  "normalizeProjectFilePath",
  "isIdentifierName",
  "inferModuleNameFromPath",
  "createModuleRuntimeName",
  "createModuleResultName",
  "normalizeProjectFiles",
  "createProjectModuleInfo",
  "tokenizeProjectSource",
  "tokenizeProjectModule",
  "collectModuleReferencesFromTokens",
  "collectDeclaredValueNamesFromTokens",
  "collectProjectModuleReferencesFromTokens",
  "buildProjectModuleRegistry",
  "populateProjectModuleDependencies",
  "collectReachableModules",
  "getProjectCompilationOrder",
]);

const scopeNames = new Set([
  "createScopeFrame",
  "createFunctionScopeBinding",
  "registerScopeVariable",
  "registerScopeFunction",
  "createObjectTypeName",
  "findScopeBinding",
  "updateScopeFunctionBinding",
  "extendTypeEnvironmentForStatement",
  "resolveThisScopeNode",
  "resolveThisMemberAccess",
  "validateThisScopeAgainstStruct",
  "registerProjectModulesAsObjects",
]);

const compilerNames = new Set([
  "createParser",
  "prepareParser",
  "parseAndValidateProgram",
  "parseProjectModule",
  "compile",
  "compileProject",
  "compileTuffToJS",
]);

const validationNames = new Set([
  "validateExpressionAsValue",
  "validateStatementList",
  "validateAST",
  "getNodeContainerType",
  "validateStructSemantics",
]);

const codegenNames = new Set([
  "generateStatementCode",
  "codegenThisScopeObject",
  "codegenFunctionLikeDeclaration",
  "codegenFunctionLikeBody",
  "codegenProgramReturn",
  "codegenProgramEvaluation",
]);

const parserPrefixes = [
  "parse",
  "tryParse",
  "prescan",
  "consume",
  "advance",
  "current",
  "peek",
  "withParsed",
  "scan",
  "checkReserved",
];

const parserNames = new Set([
  "collectTypeDeclarationNames",
  "runPrescan",
  "enterCallableScope",
  "canStartClosureParameterList",
  "consumeOptionalSemicolon",
  "extractFinalExpressionIfPresent",
  "tryConsumeMutKeyword",
  "withRestoredTypeNarrowing",
  "withTemporaryParserState",
]);

const kindHasName = new Set([
  SyntaxKind.FunctionDeclaration,
  SyntaxKind.InterfaceDeclaration,
  SyntaxKind.TypeAliasDeclaration,
  SyntaxKind.ClassDeclaration,
  SyntaxKind.EnumDeclaration,
]);

main();

function main(): void {
  const entries = getEntries(source);

  if (stepArg === "capture" || stepArg === "all") {
    runCapture(entries);
  }

  if (stepArg === "move" || stepArg === "all") {
    runMove(entries);
  }

  if (stepArg === "rearrange" || stepArg === "all") {
    runRearrange();
  }
}

function runCapture(entries: Entry[]): void {
  const payload = entries.map((entry) => ({
    name: entry.primaryName,
    names: entry.names,
    kind: entry.kindName,
    line: entry.line,
    group: entry.groupKey,
    output: normalizeSlashes(getGroupFilePath(entry.groupKey)),
  }));

  mkdirSync(path.dirname(captureOutputPath), { recursive: true });
  writeFileSync(
    captureOutputPath,
    JSON.stringify(payload, undefined, 2) + "\n",
  );
  console.log(
    "Captured " +
      payload.length +
      " top-level declarations to " +
      normalizeSlashes(captureOutputPath),
  );
}

function runMove(entries: Entry[]): void {
  if (existsSync(compilerRootPath)) {
    rmSync(compilerRootPath, { recursive: true, force: true });
  }

  const externalImports = getExternalImports(source);
  const declarationMap = buildDeclarationMap(entries);
  const groupedEntries = new Map<string, Entry[]>();

  for (const entry of entries) {
    const list = groupedEntries.get(entry.groupKey) ?? [];
    list.push(entry);
    groupedEntries.set(entry.groupKey, list);
  }

  for (const config of groupConfigs) {
    const groupEntries = groupedEntries.get(config.key) ?? [];
    if (groupEntries.length === 0) {
      continue;
    }

    const absolutePath = path.join(process.cwd(), config.filePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });

    const imports = collectGroupImports(
      groupEntries,
      declarationMap,
      externalImports,
      absolutePath,
    );

    const fileText = renderGroupFile(imports, groupEntries);
    writeFileSync(absolutePath, fileText);
    console.log(
      "Wrote " +
        groupEntries.length +
        " declarations to " +
        normalizeSlashes(absolutePath),
    );
  }
}

function runRearrange(): void {
  const facade = [
    'export { compile, compileProject, compileTuffToJS } from "./compiler";',
    "",
  ].join("\n");
  writeFileSync(rootFacadePath, facade);
  console.log("Updated src/compile.ts facade");
}

function getEntries(sourceFile: SourceFile): Entry[] {
  const entries: Entry[] = [];

  for (const statement of sourceFile.getStatements()) {
    if (Node.isImportDeclaration(statement)) {
      continue;
    }

    const names = getStatementNames(statement);
    if (names.length === 0) {
      continue;
    }

    const primaryName = names[0] ?? "";
    const kindName = statement.getKindName();
    const line = statement.getStartLineNumber();
    entries.push({
      names,
      primaryName,
      kindName,
      line,
      statement,
      groupKey: classifyEntry(primaryName, kindName, line),
      declKind: getDeclKind(statement),
      declarationNodes: getDeclarationNodes(statement),
    });
  }

  return entries;
}

function getStatementNames(statement: Statement): string[] {
  if (Node.isVariableStatement(statement)) {
    return statement
      .getDeclarations()
      .map((declaration) => declaration.getName());
  }

  if (!kindHasName.has(statement.getKind())) {
    return [];
  }

  const nameNode = (statement as unknown as NamedNode).getNameNode?.();
  if (!nameNode) {
    return [];
  }

  return [nameNode.getText()];
}

function getDeclarationNodes(statement: Statement): Node[] {
  if (Node.isVariableStatement(statement)) {
    return statement.getDeclarations();
  }

  if (!kindHasName.has(statement.getKind())) {
    return [];
  }

  const nameNode = (statement as unknown as NamedNode).getNameNode?.();
  if (!nameNode) {
    return [];
  }

  return [statement, nameNode];
}

function getDeclKind(statement: Statement): DeclKind {
  if (
    Node.isInterfaceDeclaration(statement) ||
    Node.isTypeAliasDeclaration(statement)
  ) {
    return "type";
  }

  return "value";
}

function classifyEntry(name: string, kindName: string, line: number): string {
  if (
    kindName === "InterfaceDeclaration" ||
    kindName === "TypeAliasDeclaration"
  ) {
    return "ast";
  }

  if (tokenizationNames.has(name)) {
    return "tokenization";
  }

  if (projectNames.has(name)) {
    return "project";
  }

  if (scopeNames.has(name)) {
    return "scope";
  }

  if (compilerNames.has(name)) {
    return "compiler";
  }

  if (codegenNames.has(name) || startsWith(name, "codegen")) {
    return "codegen";
  }

  if (validationNames.has(name)) {
    return "validation";
  }

  if (parserNames.has(name) || startsWithAny(name, parserPrefixes)) {
    return "parser";
  }

  if (line >= 3600 && line < 7548) {
    return "parser";
  }

  if (line >= 7548 && line < 8026) {
    return "codegen";
  }

  if (line >= 8026 && line < 8963) {
    return "validation";
  }

  return "semantics";
}

function startsWith(text: string, prefix: string): boolean {
  return text.slice(0, prefix.length) === prefix;
}

function startsWithAny(text: string, prefixes: string[]): boolean {
  for (const prefix of prefixes) {
    if (startsWith(text, prefix)) {
      return true;
    }
  }

  return false;
}

function getExternalImports(
  sourceFile: SourceFile,
): Map<string, ImportBinding> {
  const result = new Map<string, ImportBinding>();

  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    const moduleSpecifier = importDeclaration.getModuleSpecifierValue();
    for (const namedImport of importDeclaration.getNamedImports()) {
      const declarationKey = getNodeKey(namedImport);
      result.set(declarationKey, {
        moduleSpecifier: normalizeSlashes(
          resolveImportTargetPath(originalCompilePath, moduleSpecifier),
        ),
        kind: namedImport.isTypeOnly() ? "type" : "value",
        declarationKey,
      });
    }
  }

  return result;
}

function buildDeclarationMap(entries: Entry[]): Map<string, Entry> {
  const map = new Map<string, Entry>();

  for (const entry of entries) {
    for (const node of entry.declarationNodes) {
      map.set(getNodeKey(node), entry);
    }
  }

  return map;
}

function collectGroupImports(
  entries: Entry[],
  declarationMap: Map<string, Entry>,
  externalImports: Map<string, ImportBinding>,
  currentFilePath: string,
): Map<string, ImportBuckets> {
  const imports = new Map<string, ImportBuckets>();

  for (const entry of entries) {
    const localKeys = new Set(
      entry.declarationNodes.map((node) => getNodeKey(node)),
    );
    const identifiers = entry.statement.getDescendantsOfKind(
      SyntaxKind.Identifier,
    );

    for (const identifier of identifiers) {
      const symbol = identifier.getSymbol();
      if (!symbol) {
        continue;
      }

      const declaration = symbol.getDeclarations()[0];
      if (!declaration) {
        continue;
      }

      const declarationKey = getNodeKey(declaration);
      if (localKeys.has(declarationKey)) {
        continue;
      }

      const localDependency = declarationMap.get(declarationKey);
      if (localDependency) {
        if (localDependency.groupKey === entry.groupKey) {
          continue;
        }

        const moduleSpecifier = toImportSpecifier(
          currentFilePath,
          path.join(process.cwd(), getGroupFilePath(localDependency.groupKey)),
        );
        addImport(
          imports,
          moduleSpecifier,
          localDependency.primaryName,
          localDependency.declKind,
        );
        continue;
      }

      const importedDependency = externalImports.get(declarationKey);
      if (importedDependency) {
        const moduleSpecifier = toImportSpecifier(
          currentFilePath,
          importedDependency.moduleSpecifier,
        );
        addImport(
          imports,
          moduleSpecifier,
          identifier.getText(),
          importedDependency.kind,
        );
      }
    }
  }

  return imports;
}

function addImport(
  imports: Map<string, ImportBuckets>,
  moduleSpecifier: string,
  name: string,
  kind: DeclKind,
): void {
  const bucket = imports.get(moduleSpecifier) ?? {
    value: new Set<string>(),
    type: new Set<string>(),
  };

  if (kind === "type") {
    bucket.type.add(name);
  } else {
    bucket.value.add(name);
  }

  imports.set(moduleSpecifier, bucket);
}

function renderGroupFile(
  imports: Map<string, ImportBuckets>,
  entries: Entry[],
): string {
  const importLines: string[] = [];
  const sortedModuleSpecifiers = Array.from(imports.keys()).sort(
    (left, right) => left.localeCompare(right),
  );

  for (const moduleSpecifier of sortedModuleSpecifiers) {
    const bucket = imports.get(moduleSpecifier);
    if (!bucket) {
      continue;
    }

    const valueNames = Array.from(bucket.value).sort((left, right) =>
      left.localeCompare(right),
    );
    const typeNames = Array.from(bucket.type).sort((left, right) =>
      left.localeCompare(right),
    );

    if (valueNames.length > 0) {
      importLines.push(
        "import { " +
          valueNames.join(", ") +
          ' } from "' +
          moduleSpecifier +
          '";',
      );
    }

    if (typeNames.length > 0) {
      importLines.push(
        "import type { " +
          typeNames.join(", ") +
          ' } from "' +
          moduleSpecifier +
          '";',
      );
    }
  }

  const body = entries
    .sort((left, right) => left.line - right.line)
    .map((entry) => renderExportedStatement(entry.statement))
    .join("\n\n");

  const sections = [
    "// Generated by scripts/refactor/split-compile.ts",
    importLines.join("\n"),
    body,
    "",
  ].filter((section) => section.length > 0);

  return sections.join("\n\n");
}

function renderExportedStatement(statement: Statement): string {
  const tempSource = project.createSourceFile(
    "__generated-temp__.ts",
    statement.getFullText().trim(),
    { overwrite: true },
  );
  const tempStatement = tempSource.getStatements()[0];
  if (!tempStatement) {
    return "";
  }

  if (Node.isFunctionDeclaration(tempStatement)) {
    tempStatement.setIsExported(true);
  } else if (Node.isInterfaceDeclaration(tempStatement)) {
    tempStatement.setIsExported(true);
  } else if (Node.isTypeAliasDeclaration(tempStatement)) {
    tempStatement.setIsExported(true);
  } else if (Node.isVariableStatement(tempStatement)) {
    tempStatement.setIsExported(true);
  }

  return tempStatement.getFullText().trim();
}

function resolveImportTargetPath(
  sourceFilePath: string,
  moduleSpecifier: string,
): string {
  const sourceDirectory = path.dirname(sourceFilePath);
  const joined = path.resolve(sourceDirectory, moduleSpecifier);
  if (existsSync(joined + ".ts")) {
    return joined + ".ts";
  }

  if (existsSync(path.join(joined, "index.ts"))) {
    return path.join(joined, "index.ts");
  }

  return joined;
}

function toImportSpecifier(fromFilePath: string, toFilePath: string): string {
  let relativePath = path.relative(path.dirname(fromFilePath), toFilePath);
  relativePath = normalizeSlashes(relativePath);
  if (!startsWith(relativePath, ".")) {
    relativePath = "./" + relativePath;
  }

  if (relativePath.slice(-3) === ".ts") {
    relativePath = relativePath.slice(0, -3);
  }

  if (relativePath.slice(-6) === "/index") {
    relativePath = relativePath.slice(0, -6);
  }

  return relativePath;
}

function getNodeKey(node: Node): string {
  return (
    normalizeSlashes(node.getSourceFile().getFilePath()) +
    ":" +
    String(node.getStart())
  );
}

function getGroupFilePath(groupKey: string): string {
  const group = groupConfigs.find((entry) => entry.key === groupKey);
  if (!group) {
    return path.join("src", "compiler", "semantics", "type-system.ts");
  }

  return group.filePath;
}

function normalizeSlashes(text: string): string {
  return text.replaceAll("\\", "/");
}
