// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileSourceResult } from "../src/main/js/compiler.ts";

type TargetExtern = {
  name: string;
  defaults: string[];
  concrete: string;
};

const TARGETS: TargetExtern[] = [
  { name: "Vec", defaults: ["I32"], concrete: "Vec<I32>" },
  { name: "Map", defaults: ["K", "V"], concrete: "Map<I32, I32>" },
  { name: "Set", defaults: ["T"], concrete: "Set<I32>" },
];

const thisFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(thisFile), "..");

function shouldSkipDir(fullPath: string): boolean {
  const normalized = fullPath.replaceAll("\\", "/").toLowerCase();
  return (
    normalized.includes("/tests/out") ||
    normalized.endsWith("/node_modules") ||
    normalized.endsWith("/.git")
  );
}

function collectTuffFiles(dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!shouldSkipDir(full)) collectTuffFiles(full, out);
      continue;
    }
    if (entry.isFile() && full.endsWith(".tuff")) out.push(full);
  }
}

function inferParamsFromAppliedTypes(source: string, name: string): string[] {
  const rx = new RegExp(`\\b${name}\\s*<([^>]+)>`, "g");
  const order: string[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null = null;
  while ((match = rx.exec(source)) !== null) {
    const inner = match[1] ?? "";
    for (const rawPart of inner.split(",")) {
      const part = rawPart.trim();
      if (!/^[A-Z][A-Za-z0-9_]*$/.test(part)) continue;
      if (seen.has(part)) continue;
      seen.add(part);
      order.push(part);
    }
  }
  return order;
}

type MigrateResult = { output: string; changed: boolean };

function migrateExternTypeDecls(source: string): MigrateResult {
  let output = source;
  let changed = false;

  for (const target of TARGETS) {
    const declRx = new RegExp(
      `(^|\\n)(\\s*extern\\s+type\\s+${target.name}\\s*;)(?=\\n|$)`,
      "g",
    );
    output = output.replace(declRx, (_m, prefix) => {
      const inferred = inferParamsFromAppliedTypes(source, target.name);
      const finalParams = inferred.length > 0 ? inferred : target.defaults;
      changed = true;
      return `${prefix}extern type ${target.name}<${finalParams.join(", ")}>;`;
    });
  }

  return { output, changed };
}

function migrateBareGenericTypeUsages(source: string): {
  output: string;
  changed: boolean;
} {
  let output = source;
  let changed = false;

  for (const target of TARGETS) {
    const escaped = target.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const patterns: RegExp[] = [
      // Type annotations / return types.
      new RegExp(
        `(:\\s*(?:\\*\\s*)?(?:mut\\s+)?(?:[A-Za-z_][A-Za-z0-9_]*\\s+)?)(` +
          escaped +
          `)\\b(?!\\s*<)`,
        "g",
      ),
      // Generic argument positions.
      new RegExp(`(<\\s*)(` + escaped + `)\\b(?!\\s*<)`, "g"),
      new RegExp(`(,\\s*)(` + escaped + `)\\b(?!\\s*<)`, "g"),
      // Union type positions.
      new RegExp(`(\\|\\s*)(` + escaped + `)\\b(?!\\s*<)`, "g"),
    ];

    for (const rx of patterns) {
      output = output.replace(rx, (_m, prefix) => {
        changed = true;
        return `${prefix}${target.concrete}`;
      });
    }
  }

  // Repair any previously-corrupted suffix artifacts from older script runs.
  const cleaned = output
    .replace(/Vec<I32>\d+/g, "Vec<I32>")
    .replace(/Map<I32, I32>\d+/g, "Map<I32, I32>")
    .replace(/Set<I32>\d+/g, "Set<I32>");
  if (cleaned !== output) {
    changed = true;
    output = cleaned;
  }

  return { output, changed };
}

function transformViaAstRoundTrip(source: string, fileLabel: string): string {
  const compiled = compileSourceResult(source, fileLabel, {
    backend: "selfhost",
    target: "tuff",
  });
  if (!compiled.ok) {
    throw new Error(
      `AST round-trip failed for ${fileLabel}: ${String(compiled.error?.message ?? compiled.error)}`,
    );
  }
  return String(compiled.value.output ?? source);
}

function main(): void {
  const candidateRoots = [
    path.join(root, "src", "main", "tuff"),
    path.join(root, "src", "main", "tuff-core"),
    path.join(root, "src", "main", "tuff-js"),
    path.join(root, "src", "main", "tuff-c"),
    path.join(root, "src", "test", "tuff"),
    path.join(root, "tests"),
  ];

  const files: string[] = [];
  for (const dir of candidateRoots) {
    if (fs.existsSync(dir)) collectTuffFiles(dir, files);
  }

  let visited = 0;
  let changedCount = 0;
  let roundTripFailed = 0;
  let fallbackMigrated = 0;

  for (const absPath of files) {
    const source = fs.readFileSync(absPath, "utf8");
    if (!/\b(Vec|Map|Set)\b/.test(source)) continue;

    visited += 1;
    const rel = path.relative(root, absPath).replaceAll("\\", "/");

    let base = source;
    let usedFallback = false;
    try {
      base = transformViaAstRoundTrip(source, rel);
    } catch {
      roundTripFailed += 1;
      usedFallback = true;
      base = source;
    }

    const migratedDecls = migrateExternTypeDecls(base);
    const migratedTypes = migrateBareGenericTypeUsages(migratedDecls.output);
    if (migratedTypes.output === source) continue;

    fs.writeFileSync(absPath, migratedTypes.output, "utf8");
    changedCount += 1;
    if (usedFallback) fallbackMigrated += 1;
    console.log(`[migrate-extern-type-generics] wrote ${rel}`);
  }

  const scanSummary = `[migrate-extern-type-generics] scanned ${files.length} .tuff file(s), visited ${visited} candidate(s), changed ${changedCount} file(s), roundtrip-failed ${roundTripFailed}, fallback-migrated ${fallbackMigrated}`;
  console.log(scanSummary);
}

main();
