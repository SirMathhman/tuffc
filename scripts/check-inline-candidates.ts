import {
  Project,
  Node,
  FunctionDeclaration,
  CallExpression,
  SyntaxKind,
  Block,
} from "ts-morph";
import { readFileSync } from "fs";
import { resolve } from "path";

function extractNumberAfter(text: string, keyword: string): number | undefined {
  const keywordIndex = text.indexOf(keyword);
  if (keywordIndex === -1) {
    return undefined;
  }
  const afterKeyword = text.slice(keywordIndex);
  const maxIndex = afterKeyword.indexOf("max:");
  if (maxIndex === -1) {
    return undefined;
  }
  const afterMax = afterKeyword.slice(maxIndex + 4).trimStart();
  let numStr = "";
  let ci = 0;
  while (ci < afterMax.length && afterMax[ci] >= "0" && afterMax[ci] <= "9") {
    numStr += afterMax[ci];
    ci++;
  }
  if (numStr.length === 0) {
    return undefined;
  }
  return parseInt(numStr, 10);
}

function readMaxLinesFromEslint(): number | undefined {
  const configPath = resolve("eslint.config.js");
  const raw = readFileSync(configPath, "utf-8");
  return extractNumberAfter(raw, "max-lines-per-function");
}

function countBodyLines(fn: FunctionDeclaration): number {
  const body = fn.getBody();
  if (body === undefined) {
    return 0;
  }
  const text = body.getText();
  const lines = text.split("\n");
  let count = 0;
  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (trimmed.length > 0 && !trimmed.startsWith("//")) {
      count++;
    }
    i++;
  }
  return count;
}

function findUsages(
  fn: FunctionDeclaration,
  project: Project,
): CallExpression[] {
  const name = fn.getName();
  if (name === undefined) {
    return [];
  }
  const usages: CallExpression[] = [];
  const sourceFiles = project.getSourceFiles();
  let fi = 0;
  while (fi < sourceFiles.length) {
    const sf = sourceFiles[fi];
    const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
    let ci = 0;
    while (ci < calls.length) {
      const call = calls[ci];
      if (Node.isCallExpression(call)) {
        const expr = call.getExpression();
        if (expr.getText() === name) {
          usages.push(call);
        }
      }
      ci++;
    }
    fi++;
  }
  return usages;
}

function findCallerFunction(
  call: CallExpression,
): FunctionDeclaration | undefined {
  let node: Node | undefined = call.getParent();
  while (node !== undefined) {
    if (Node.isFunctionDeclaration(node)) {
      return node;
    }
    node = node.getParent();
  }
  return undefined;
}

const PADDING = 2;

interface Candidate {
  fnName: string;
  callerName: string;
  callerLines: number;
  inlinedLines: number;
  combined: number;
}

function findBestInlineCandidates(
  sourceFiles: import("ts-morph").SourceFile[],
  maxLines: number,
  project: import("ts-morph").Project,
): Map<string, Candidate> {
  const bestPerCaller = new Map<string, Candidate>();
  let fi = 0;
  while (fi < sourceFiles.length) {
    const sf = sourceFiles[fi];
    const functions = sf.getFunctions();
    let fni = 0;
    while (fni < functions.length) {
      const fn = functions[fni];
      const usages = findUsages(fn, project);
      if (usages.length === 1) {
        const inlinedLines = countBodyLines(fn);
        const caller = findCallerFunction(usages[0]);
        if (caller !== undefined) {
          const callerLines = countBodyLines(caller);
          const combined = callerLines + inlinedLines + PADDING;
          if (combined <= maxLines) {
            const callerName = caller.getName() ?? "(anonymous)";
            const fnName = fn.getName() ?? "(anonymous)";
            const existing = bestPerCaller.get(callerName);
            if (
              existing === undefined ||
              inlinedLines > existing.inlinedLines
            ) {
              bestPerCaller.set(callerName, {
                fnName,
                callerName,
                callerLines,
                inlinedLines,
                combined,
              });
            }
          }
        }
      }
      fni++;
    }
    fi++;
  }
  return bestPerCaller;
}

function isIdentChar(c: string): boolean {
  const isLower = c >= "a" && c <= "z";
  const isUpper = c >= "A" && c <= "Z";
  const isDigit = c >= "0" && c <= "9";
  return isLower || isUpper || isDigit || c === "_";
}

function replaceIdentifier(text: string, from: string, to: string): string {
  let result = "";
  let i = 0;
  while (i < text.length) {
    let prevChar = "";
    if (i > 0) {
      prevChar = text[i - 1];
    }
    if (text.startsWith(from, i) && !isIdentChar(prevChar)) {
      const afterIdx = i + from.length;
      let nextChar = "";
      if (afterIdx < text.length) {
        nextChar = text[afterIdx];
      }
      if (!isIdentChar(nextChar)) {
        result += to;
        i = afterIdx;
        continue;
      }
    }
    result += text[i];
    i++;
  }
  return result;
}

function applyRenames(text: string, renameMap: Map<string, string>): string {
  let result = text;
  renameMap.forEach((newName, oldName) => {
    result = replaceIdentifier(result, oldName, newName);
  });
  return result;
}

function extractReturnExpression(stmt: string): string | undefined {
  const trimmed = stmt.trim();
  const prefix = "return ";
  if (!trimmed.startsWith(prefix)) {
    return undefined;
  }
  const rest = trimmed.slice(prefix.length);
  if (rest.endsWith(";")) {
    return rest.slice(0, -1);
  }
  return rest;
}

function collectDeclaredNames(
  stmts: import("ts-morph").Statement[],
): string[] {
  const names: string[] = [];
  let i = 0;
  while (i < stmts.length) {
    const stmt = stmts[i];
    if (Node.isVariableStatement(stmt)) {
      stmt.getDeclarationList().getDeclarations().forEach((decl) => {
        names.push(decl.getName());
      });
    }
    i++;
  }
  return names;
}

function buildRenameMap(
  calleeNames: string[],
  callerNames: Set<string>,
): Map<string, string> {
  const renameMap = new Map<string, string>();
  let i = 0;
  while (i < calleeNames.length) {
    const name = calleeNames[i];
    if (callerNames.has(name)) {
      let suffix = 0;
      let newName = name + String(suffix);
      while (callerNames.has(newName)) {
        suffix++;
        newName = name + String(suffix);
      }
      renameMap.set(name, newName);
      callerNames.add(newName);
    }
    i++;
  }
  return renameMap;
}

function findContainingStatement(call: CallExpression): Node | undefined {
  let node: Node = call;
  while (true) {
    const parent = node.getParent();
    if (parent === undefined) {
      return undefined;
    }
    if (Node.isBlock(parent)) {
      return node;
    }
    node = parent;
  }
}

function inlineFunction(fn: FunctionDeclaration, call: CallExpression): void {
  const caller = findCallerFunction(call);
  if (caller === undefined) {
    return;
  }
  const body = fn.getBody() as Block;
  const stmts = body.getStatements();
  const calleeNames = collectDeclaredNames(stmts);
  const callerNames = new Set(collectDeclaredNames((caller.getBody() as Block).getStatements()));
  const renameMap = buildRenameMap(calleeNames, callerNames);
  const lastStmt = stmts[stmts.length - 1];
  const prefixStmts = stmts.slice(0, stmts.length - 1);
  let returnExpr = extractReturnExpression(lastStmt.getText());
  if (returnExpr === undefined) {
    returnExpr = lastStmt.getText();
  }
  const renamedReturn = applyRenames(returnExpr, renameMap);
  const renamedPrefixes = prefixStmts.map((s) => applyRenames(s.getText(), renameMap));
  const containingStmt = findContainingStatement(call);
  if (containingStmt === undefined) {
    return;
  }
  const stmtStart = containingStmt.getStart();
  const stmtText = containingStmt.getText();
  const newStmtText =
    stmtText.slice(0, call.getStart() - stmtStart) +
    renamedReturn +
    stmtText.slice(call.getEnd() - stmtStart);
  containingStmt.replaceWithText([...renamedPrefixes, newStmtText].join("\n"));
  fn.remove();
}

function main(): void {
  const maxLines = readMaxLinesFromEslint();
  if (maxLines === undefined) {
    console.error(
      "Could not find max-lines-per-function rule in eslint.config.js",
    );
    return;
  }
  const project = new Project({ tsConfigFilePath: resolve("tsconfig.json") });
  const sourceFiles = project.getSourceFiles();
  const bestPerCaller = findBestInlineCandidates(
    sourceFiles,
    maxLines,
    project,
  );
  if (bestPerCaller.size === 0) {
    return;
  }
  bestPerCaller.forEach((c) => {
    console.log(
      `✓ inlining: ${c.fnName} into ${c.callerName} ` +
        `(${c.callerLines} + ${c.inlinedLines} + ${PADDING} padding = ${c.combined} / ${maxLines})`,
    );
  });
  const allFunctions = sourceFiles.flatMap((sf) => sf.getFunctions());
  bestPerCaller.forEach((c) => {
    const fn = allFunctions.find((f) => f.getName() === c.fnName);
    if (fn === undefined) return;
    const usages = findUsages(fn, project);
    if (usages.length === 1) {
      inlineFunction(fn, usages[0]);
    }
  });
  project.saveSync();
  process.exit(1);
}

main();
