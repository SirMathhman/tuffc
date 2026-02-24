import crypto from "node:crypto";
import fs from "node:fs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PropertyRecord {
  /** Short identifier used in code and tooling. */
  id: string;
  /** Human-readable property name. */
  name: string;
  /** Plain-English description of what is prevented. */
  description: string;
  /** Compiler pass(es) that enforce this property. */
  enforcedBy: string[];
  /** Error code prefixes emitted when this property would be violated. */
  errorCodePrefixes: string[];
}

export interface SourceFileRecord {
  path: string;
  sha256: string;
}

export interface CompilationOutcome {
  success: boolean;
  /** All diagnostic error codes emitted during compilation, if any. */
  diagnosticCodes: string[];
}

export interface VerificationCertificate {
  schemaVersion: "1.0";
  documentTitle: string;
  compilerVersion: string;
  /** ISO 8601 UTC timestamp of when the certificate was generated. */
  timestamp: string;
  sourceFiles: SourceFileRecord[];
  /** SHA-256 over the concatenation of all per-file hashes, in order. */
  combinedSha256: string;
  properties: PropertyRecord[];
  compilationOutcome: CompilationOutcome;
  /**
   * A statement of what this certificate asserts.
   */
  certifies: string;
  /**
   * An explicit statement of what this certificate does NOT assert.
   */
  doesNotCertify: string;
}

// ---------------------------------------------------------------------------
// Static enforcement manifest (derived from SPECIFICATION.md §9.2)
// ---------------------------------------------------------------------------

const TUFF_SAFETY_PROPERTIES: PropertyRecord[] = [
  {
    id: "no-buffer-overflows",
    name: "No Buffer Overflows",
    description:
      "Every array access is statically proven to lie within the bounds of its " +
      "allocation. Accesses whose bounds cannot be proven at compile time are " +
      "rejected with a compile-time error.",
    enforcedBy: ["typecheck"],
    errorCodePrefixes: ["E_SAFETY_ARRAY_BOUNDS"],
  },
  {
    id: "no-null-dereferences",
    name: "No Null Dereferences",
    description:
      "Nullable pointer types must be guarded before dereferencing. The type " +
      "system tracks nullability and rejects any unguarded dereference of a " +
      "nullable value.",
    enforcedBy: ["typecheck"],
    errorCodePrefixes: ["E_SAFETY_NULLABLE_POINTER_GUARD"],
  },
  {
    id: "no-integer-overflow",
    name: "No Integer Overflow / Underflow",
    description:
      "Arithmetic operations on fixed-width integer types are checked for " +
      "overflow and underflow at compile time where possible. Expressions that " +
      "could silently wrap are rejected.",
    enforcedBy: ["typecheck"],
    errorCodePrefixes: ["E_SAFETY_INTEGER_OVERFLOW"],
  },
  {
    id: "no-division-by-zero",
    name: "No Division by Zero",
    description:
      "Integer division operations where the divisor cannot be statically " +
      "proven non-zero are rejected by the compiler.",
    enforcedBy: ["typecheck"],
    errorCodePrefixes: ["E_SAFETY_DIV_BY_ZERO"],
  },
  {
    id: "no-modulo-by-zero",
    name: "No Modulo by Zero",
    description:
      "Integer modulo operations where the divisor cannot be statically " +
      "proven non-zero are rejected by the compiler.",
    enforcedBy: ["typecheck"],
    errorCodePrefixes: ["E_SAFETY_MOD_BY_ZERO"],
  },
  {
    id: "no-data-races",
    name: "No Data Races",
    description:
      "The ownership and borrowing system ensures that mutable state is " +
      "accessed by at most one part of the program at a time. Concurrent " +
      "aliased mutation is structurally impossible in well-typed Tuff programs.",
    enforcedBy: ["borrowcheck"],
    errorCodePrefixes: ["E_BORROW_"],
  },
  {
    id: "no-use-after-free",
    name: "No Use-After-Free / Double-Free",
    description:
      "The borrow checker tracks ownership of every heap allocation. Reading " +
      "or writing a moved value, and freeing the same allocation more than " +
      "once, are both compile-time errors.",
    enforcedBy: ["borrowcheck"],
    errorCodePrefixes: ["E_BORROW_USE_AFTER_MOVE", "E_BORROW_"],
  },
  {
    id: "no-undefined-control-flow",
    name: "No Undefined Control Flow (No Panics)",
    description:
      "Well-typed Tuff programs do not contain reachable panic paths. The " +
      "combination of the type checker and borrow checker eliminates the " +
      "classes of runtime errors — out-of-bounds, null, overflow, zero-division, " +
      "and bad aliasing — that are the root cause of panics in safe code.",
    enforcedBy: ["typecheck", "borrowcheck"],
    errorCodePrefixes: [
      "E_SAFETY_ARRAY_BOUNDS",
      "E_SAFETY_NULLABLE_POINTER_GUARD",
      "E_SAFETY_INTEGER_OVERFLOW",
      "E_SAFETY_DIV_BY_ZERO",
      "E_SAFETY_MOD_BY_ZERO",
      "E_BORROW_",
    ],
  },
];

const CERTIFIES_STATEMENT =
  "This certificate records that the Tuff compiler successfully parsed, " +
  "type-checked, and borrow-checked the listed source file(s). " +
  "Safety checks are always applied. If compilationOutcome.success is true, " +
  "the source satisfies all eight safety properties listed in this document as " +
  "defined by the Tuff language specification §9.2.";

const DOES_NOT_CERTIFY_STATEMENT =
  "This certificate does not assert the absence of logical errors, incorrect " +
  "algorithms, business-logic defects, or security vulnerabilities outside the " +
  "eight listed properties. It does not verify that the program produces correct " +
  "output for any given input, nor that external C code called via FFI is itself " +
  "safe. It does not constitute a formal mathematical proof; it records the " +
  "outcome of a structural compiler analysis. A failed compilationOutcome means " +
  "that one or more safety properties could not be established; the diagnosticCodes " +
  "field identifies which checks triggered.";

// ---------------------------------------------------------------------------
// SHA-256 helpers
// ---------------------------------------------------------------------------

function computeSha256(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

function computeCombinedSha256(hashes: string[]): string {
  return crypto
    .createHash("sha256")
    .update(hashes.join(""), "utf8")
    .digest("hex");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CertificateInput {
  /** Absolute paths to every source file that was compiled. */
  sourcePaths: string[];
  compilerVersion: string;
  outcome: CompilationOutcome;
}

export function buildCertificate(
  input: CertificateInput,
): VerificationCertificate {
  const sourceFiles: SourceFileRecord[] = input.sourcePaths.map((p) => {
    const content = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
    return { path: p, sha256: computeSha256(content) };
  });

  const combinedSha256 = computeCombinedSha256(
    sourceFiles.map((f) => f.sha256),
  );

  return {
    schemaVersion: "1.0",
    documentTitle: "Tuff Verification Certificate",
    compilerVersion: input.compilerVersion,
    timestamp: new Date().toISOString(),
    sourceFiles,
    combinedSha256,
    properties: TUFF_SAFETY_PROPERTIES,
    compilationOutcome: input.outcome,
    certifies: CERTIFIES_STATEMENT,
    doesNotCertify: DOES_NOT_CERTIFY_STATEMENT,
  };
}
