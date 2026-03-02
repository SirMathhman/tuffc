import {
  Project,
  Node,
  FunctionDeclaration,
  CallExpression,
  SyntaxKind,
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
  bestPerCaller.forEach((c) => {
    console.log(
      `✓ can inline: ${c.fnName} into ${c.callerName} ` +
        `(${c.callerLines} + ${c.inlinedLines} + ${PADDING} padding = ${c.combined} / ${maxLines})`,
    );
  });
  if (bestPerCaller.size > 0) {
    process.exit(1);
  }
}

main();
