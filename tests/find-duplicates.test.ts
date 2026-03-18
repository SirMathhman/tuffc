import ts from "typescript";
import { stableHash } from "../scripts/lib/hash";
import {
  canonicalize,
  DEFAULT_OPTIONS,
  type CanonicalizeOptions,
} from "../scripts/lib/ast-canonicalize";
import { collectCandidates, countNodes } from "../scripts/lib/candidates";
import {
  suppressNested,
  formatText,
  formatJson,
  type CloneClass,
} from "../scripts/lib/report";

// ── Helpers ────────────────────────────────────────────────────────────────────

function parse(code: string, fileName = "fixture.ts"): ts.SourceFile {
  return ts.createSourceFile(
    fileName,
    code,
    ts.ScriptTarget.Latest,
    /*setParentNodes*/ true,
    ts.ScriptKind.TS,
  );
}

function firstFunctionBody(sf: ts.SourceFile): ts.Block {
  let found: ts.Block | undefined;
  ts.forEachChild(sf, (node) => {
    if (!found && ts.isFunctionDeclaration(node) && node.body) {
      found = node.body;
    }
  });
  if (!found) throw new Error("No function declaration found in fixture");
  return found;
}

function firstChildNodeCount(sf: ts.SourceFile): number {
  let count = 0;
  ts.forEachChild(sf, (n) => {
    if (count === 0) count = countNodes(n);
  });
  return count;
}

function twoFileSources(
  src1: string,
  src2: string,
): Array<{ fileName: string; code: string }> {
  return [
    { fileName: "a.ts", code: src1 },
    { fileName: "b.ts", code: src2 },
  ];
}

// ── stableHash ────────────────────────────────────────────────────────────────

describe("stableHash", () => {
  test("same input produces same hash", () => {
    expect(stableHash("hello")).toBe(stableHash("hello"));
  });

  test("different input produces different hash", () => {
    expect(stableHash("hello")).not.toBe(stableHash("world"));
  });

  test("output is 16 hex characters", () => {
    expect(stableHash("test")).toMatch(/^[0-9a-f]{16}$/);
  });
});

// ── countNodes ────────────────────────────────────────────────────────────────

describe("countNodes", () => {
  test("leaf node has count 1", () => {
    const sf = parse("x;");
    // The ExpressionStatement wraps an Identifier; count >= 1
    ts.forEachChild(sf, (n) => {
      expect(countNodes(n)).toBeGreaterThanOrEqual(1);
    });
  });

  test("node count increases with complexity", () => {
    const simple = parse("function f() { return 1; }");
    const complex = parse(
      "function f() { const x = 1; const y = 2; return x + y; }",
    );

    const simpleCount = firstChildNodeCount(simple);
    const complexCount = firstChildNodeCount(complex);

    expect(complexCount).toBeGreaterThan(simpleCount);
  });
});

// ── canonicalize ─────────────────────────────────────────────────────────────

describe("canonicalize", () => {
  test("identical code produces identical canonical form", () => {
    const sf1 = parse(
      "function add(a: number, b: number): number { return a + b; }",
    );
    const sf2 = parse(
      "function add(a: number, b: number): number { return a + b; }",
    );
    const body1 = firstFunctionBody(sf1);
    const body2 = firstFunctionBody(sf2);
    expect(canonicalize(body1, DEFAULT_OPTIONS)).toBe(
      canonicalize(body2, DEFAULT_OPTIONS),
    );
  });

  test("normalizeIdentifiers=true: alpha-renamed code is identical", () => {
    const sf1 = parse(
      "function add(a: number, b: number): number { return a + b; }",
    );
    const sf2 = parse(
      "function sum(x: number, y: number): number { return x + y; }",
    );
    const body1 = firstFunctionBody(sf1);
    const body2 = firstFunctionBody(sf2);
    const opts: CanonicalizeOptions = {
      ...DEFAULT_OPTIONS,
      normalizeIdentifiers: true,
    };
    expect(canonicalize(body1, opts)).toBe(canonicalize(body2, opts));
  });

  test("normalizeIdentifiers=false: alpha-renamed code differs", () => {
    const sf1 = parse(
      "function add(a: number, b: number): number { return a + b; }",
    );
    const sf2 = parse(
      "function sum(x: number, y: number): number { return x + y; }",
    );
    const body1 = firstFunctionBody(sf1);
    const body2 = firstFunctionBody(sf2);
    const opts: CanonicalizeOptions = {
      ...DEFAULT_OPTIONS,
      normalizeIdentifiers: false,
    };
    expect(canonicalize(body1, opts)).not.toBe(canonicalize(body2, opts));
  });

  test("structurally different code produces different canonical form", () => {
    const sf1 = parse("function f(a: number, b: number) { return a + b; }");
    const sf2 = parse("function f(a: number, b: number) { return a * b; }");
    const body1 = firstFunctionBody(sf1);
    const body2 = firstFunctionBody(sf2);
    expect(canonicalize(body1, DEFAULT_OPTIONS)).not.toBe(
      canonicalize(body2, DEFAULT_OPTIONS),
    );
  });

  test("normalizeLiterals=true: different literal values produce same form", () => {
    const sf1 = parse(`function f() { return "hello"; }`);
    const sf2 = parse(`function f() { return "world"; }`);
    const body1 = firstFunctionBody(sf1);
    const body2 = firstFunctionBody(sf2);
    const opts: CanonicalizeOptions = {
      ...DEFAULT_OPTIONS,
      normalizeLiterals: true,
    };
    expect(canonicalize(body1, opts)).toBe(canonicalize(body2, opts));
  });

  test("normalizeLiterals=false: different literal values produce different form", () => {
    const sf1 = parse(`function f() { return "hello"; }`);
    const sf2 = parse(`function f() { return "world"; }`);
    const body1 = firstFunctionBody(sf1);
    const body2 = firstFunctionBody(sf2);
    const opts: CanonicalizeOptions = {
      ...DEFAULT_OPTIONS,
      normalizeLiterals: false,
    };
    expect(canonicalize(body1, opts)).not.toBe(canonicalize(body2, opts));
  });

  test("keepTypeAnnotations=false: same logic with different types matches", () => {
    const sf1 = parse("function f(a: number): number { return a; }");
    const sf2 = parse("function f(a: string): string { return a; }");
    const body1 = firstFunctionBody(sf1);
    const body2 = firstFunctionBody(sf2);
    const opts: CanonicalizeOptions = {
      ...DEFAULT_OPTIONS,
      keepTypeAnnotations: false,
    };
    expect(canonicalize(body1, opts)).toBe(canonicalize(body2, opts));
  });
});

// ── collectCandidates ─────────────────────────────────────────────────────────

describe("collectCandidates", () => {
  test("returns candidates above minNodeCount threshold", () => {
    const code = `
function bigFunction(x: number, y: number, z: number): number {
  const a = x + y;
  const b = y + z;
  const c = a * b;
  return c;
}`;
    const sf = parse(code);
    const candidates = collectCandidates(sf, "fixture.ts", 5, 1);
    expect(candidates.length).toBeGreaterThan(0);
  });

  test("returns no candidates when minNodeCount is very high", () => {
    const sf = parse("function f() { return 1; }");
    const candidates = collectCandidates(sf, "fixture.ts", 100000, 1);
    expect(candidates.length).toBe(0);
  });

  test("candidate line numbers are 1-based", () => {
    const sf = parse("function f(a: number): number { return a + 1; }");
    const candidates = collectCandidates(sf, "fixture.ts", 1, 1);
    for (const c of candidates) {
      expect(c.lineStart).toBeGreaterThanOrEqual(1);
      expect(c.lineEnd).toBeGreaterThanOrEqual(c.lineStart);
    }
  });

  test("respects minLines threshold", () => {
    const sf = parse("function f() { return 1; }"); // single line
    const candidates = collectCandidates(sf, "fixture.ts", 1, 10);
    expect(candidates.length).toBe(0);
  });
});

// ── suppressNested ────────────────────────────────────────────────────────────

describe("suppressNested", () => {
  const makeClass = (
    id: number,
    nodeCount: number,
    occurrences: Array<{
      filePath: string;
      lineStart: number;
      lineEnd: number;
    }>,
  ): CloneClass => ({
    id,
    hash: `hash${id}`,
    nodeCount,
    occurrences: occurrences.map((o) => ({
      ...o,
      nodeCount,
      kindName: "Block",
    })),
  });

  test("retains all when no nesting", () => {
    const classes = [
      makeClass(1, 50, [{ filePath: "a.ts", lineStart: 1, lineEnd: 10 }]),
      makeClass(2, 60, [{ filePath: "b.ts", lineStart: 1, lineEnd: 10 }]),
    ];
    expect(suppressNested(classes)).toHaveLength(2);
  });

  const sharedSmallOccurrences = [
    { filePath: "a.ts", lineStart: 5, lineEnd: 10 },
    { filePath: "b.ts", lineStart: 5, lineEnd: 10 },
  ];

  test("suppresses smaller class fully contained in larger class", () => {
    const large = makeClass(1, 100, [
      { filePath: "a.ts", lineStart: 1, lineEnd: 20 },
      { filePath: "b.ts", lineStart: 1, lineEnd: 20 },
    ]);
    const small = makeClass(2, 30, sharedSmallOccurrences);
    const result = suppressNested([large, small]);
    expect(result.map((c) => c.id)).toContain(1);
    expect(result.map((c) => c.id)).not.toContain(2);
  });

  test("keeps smaller class when only partially nested", () => {
    const large = makeClass(1, 100, [
      { filePath: "a.ts", lineStart: 1, lineEnd: 20 },
      // No occurrence in b.ts — small's second occurrence isn't covered
    ]);
    const small = makeClass(2, 30, sharedSmallOccurrences);
    const result = suppressNested([large, small]);
    expect(result.map((c) => c.id)).toContain(2);
  });
});

// ── formatText + formatJson ────────────────────────────────────────────────────

describe("formatText", () => {
  test("returns no-duplicates message for empty input", () => {
    expect(formatText([])).toContain("No duplicate");
  });

  test("lists clone classes with hash and occurrences", () => {
    const classes: CloneClass[] = [
      {
        id: 1,
        hash: "abc123",
        nodeCount: 42,
        occurrences: [
          {
            filePath: "a.ts",
            lineStart: 1,
            lineEnd: 5,
            nodeCount: 42,
            kindName: "Block",
          },
          {
            filePath: "b.ts",
            lineStart: 10,
            lineEnd: 14,
            nodeCount: 42,
            kindName: "Block",
          },
        ],
      },
    ];
    const text = formatText(classes);
    expect(text).toContain("abc123");
    expect(text).toContain("a.ts");
    expect(text).toContain("b.ts");
  });
});

describe("formatJson", () => {
  test("produces valid JSON with cloneClasses key", () => {
    const classes: CloneClass[] = [];
    const json = JSON.parse(formatJson(classes));
    expect(json).toHaveProperty("cloneClasses");
    expect(Array.isArray(json.cloneClasses)).toBe(true);
  });
});

// ── End-to-end: detect duplicates across two fixture strings ──────────────────

describe("end-to-end duplicate detection", () => {
  function detectDuplicates(
    sources: Array<{ fileName: string; code: string }>,
    minNodeCount = 5,
    minLines = 1,
    opts: Partial<CanonicalizeOptions> = {},
  ): CloneClass[] {
    const canonOpts: CanonicalizeOptions = { ...DEFAULT_OPTIONS, ...opts };
    const hashMap = new Map<
      string,
      {
        occurrences: Array<{
          filePath: string;
          lineStart: number;
          lineEnd: number;
          nodeCount: number;
          kindName: string;
        }>;
        nodeCount: number;
      }
    >();

    for (const { fileName, code } of sources) {
      const sf = parse(code, fileName);
      const candidates = collectCandidates(
        sf,
        fileName,
        minNodeCount,
        minLines,
      );
      for (const cand of candidates) {
        const canonical = canonicalize(cand.node, canonOpts);
        const hash = stableHash(canonical);
        const occ = {
          filePath: fileName,
          lineStart: cand.lineStart,
          lineEnd: cand.lineEnd,
          nodeCount: cand.nodeCount,
          kindName: cand.kindName,
        };
        const bucket = hashMap.get(hash);
        if (bucket) {
          bucket.occurrences.push(occ);
        } else {
          hashMap.set(hash, { occurrences: [occ], nodeCount: cand.nodeCount });
        }
      }
    }

    const classes: CloneClass[] = [];
    let id = 1;
    for (const [hash, { occurrences, nodeCount }] of hashMap) {
      if (occurrences.length >= 2) {
        classes.push({ id: id++, hash, nodeCount, occurrences });
      }
    }
    return classes;
  }

  test("detects identical function bodies across two files", () => {
    const sharedBody = `{
  const result = a + b;
  const extra = result * 2;
  return extra;
}`;
    const src1 = `function compute(a: number, b: number): number ${sharedBody}`;
    const src2 = `function calculate(a: number, b: number): number ${sharedBody}`;

    const classes = detectDuplicates(twoFileSources(src1, src2), 5, 3, {
      normalizeIdentifiers: false,
    });
    expect(classes.length).toBeGreaterThan(0);
    const filesSeen = new Set(
      classes.flatMap((c) => c.occurrences.map((o) => o.filePath)),
    );
    expect(filesSeen.has("a.ts")).toBe(true);
    expect(filesSeen.has("b.ts")).toBe(true);
  });

  test("does NOT detect non-structurally-equivalent code as duplicates", () => {
    const src1 = `function add(a: number, b: number): number { return a + b; }`;
    const src2 = `function mul(a: number, b: number): number { return a * b; }`;

    // Use minNodeCount=15 to collect only whole function declarations, where
    // the differing operator (+ vs *) makes the two functions structurally inequivalent.
    // A lower threshold would also collect individual parameter nodes like
    // `a: number` which happen to be structurally identical between the two functions.
    const classes = detectDuplicates(twoFileSources(src1, src2), 15, 1);
    expect(classes.length).toBe(0);
  });

  test("detects alpha-renamed duplicates with normalizeIdentifiers=true", () => {
    const src1 = `function add(a: number, b: number): number {
  const sum = a + b;
  const doubled = sum * 2;
  return doubled;
}`;
    const src2 = `function compute(x: number, y: number): number {
  const total = x + y;
  const result = total * 2;
  return result;
}`;

    const classes = detectDuplicates(twoFileSources(src1, src2), 8, 3, {
      normalizeIdentifiers: true,
    });
    expect(classes.length).toBeGreaterThan(0);
  });

  test("does NOT detect alpha-renamed duplicates with normalizeIdentifiers=false", () => {
    const src1 = `function add(a: number, b: number): number {
  const sum = a + b;
  const doubled = sum * 2;
  return doubled;
}`;
    const src2 = `function compute(x: number, y: number): number {
  const total = x + y;
  const result = total * 2;
  return result;
}`;

    const classes = detectDuplicates(twoFileSources(src1, src2), 8, 3, {
      normalizeIdentifiers: false,
    });
    expect(classes.length).toBe(0);
  });
});
