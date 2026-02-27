/**
 * Tests for --emit-certificate flag and the certificate artifact.
 *
 * Checks that:
 * 1. A successful compilation with --emit-certificate writes valid JSON
 * 2. The JSON contains all 8 safety properties
 * 3. Source file hashes are 64-char hex strings
 * 4. Combined hash is a 64-char hex string
 * 5. compilationOutcome.success === true on success
 * 6. A compilation failure still writes the certificate with success === false
 * 7. Missing --emit-certificate value exits non-zero with a clear message
 * 8. The adjacent .typ file is written
 */
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { getCLIPaths, getTestsOutDir } from "./path-test-utils.ts";

const { root, tsxCli, nodeExec } = getCLIPaths(import.meta.url);

const outDir = getTestsOutDir(root, "certificate");
fs.mkdirSync(outDir, { recursive: true });

function runCli(args: string[]) {
  const cliArgs = [tsxCli, "./src/main/js/cli.ts", ...args];
  return spawnSync(nodeExec, cliArgs, { cwd: root, encoding: "utf8" });
}

import { assertEq, assertTrue } from "./assert-utils.ts";

function runCliExpectError(args: string[], label: string) {
  const r = runCli(args);
  assertTrue(r.status !== 0, `${label}: expected non-zero exit`);
  return r;
}

function readCert(certPath: string): Record<string, unknown> {
  assertTrue(fs.existsSync(certPath), `cert file exists: ${certPath}`);
  const text = fs.readFileSync(certPath, "utf8");
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    console.error(`cert is not valid JSON:\n${text}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Test 1: successful compilation emits valid certificate
// ---------------------------------------------------------------------------
{
  const label = "success-certificate";
  const certPath = path.join(outDir, "success.cert.json");
  const jsOut = path.join(outDir, "success.js");

  const r = runCli([
    "./src/test/tuff/cases/factorial.tuff",
    "-o",
    jsOut,
    "--emit-certificate",
    certPath,
  ]);

  if (r.status !== 0) {
    console.error(`${label}: expected zero exit, got ${r.status}\n${r.stderr}`);
    process.exit(1);
  }

  const combined = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  assertTrue(
    combined.includes("Certificate written to"),
    `${label}: stdout mentions certificate`,
  );

  const cert = readCert(certPath);

  // Schema version and title
  assertEq(cert["schemaVersion"], "1.0", `${label}: schemaVersion`);
  assertEq(
    cert["documentTitle"],
    "Tuff Verification Certificate",
    `${label}: documentTitle`,
  );

  // Compiler version present and non-empty
  assertTrue(
    typeof cert["compilerVersion"] === "string" &&
      (cert["compilerVersion"] as string).length > 0,
    `${label}: compilerVersion present`,
  );

  // Timestamp looks like ISO 8601
  assertTrue(
    typeof cert["timestamp"] === "string" &&
      /^\d{4}-\d{2}-\d{2}T/.test(cert["timestamp"] as string),
    `${label}: timestamp is ISO 8601`,
  );

  // Source files hashes
  const sourceFiles = cert["sourceFiles"] as Array<{
    path: string;
    sha256: string;
  }>;
  assertTrue(
    Array.isArray(sourceFiles) && sourceFiles.length === 1,
    `${label}: one source file`,
  );
  assertTrue(
    /^[0-9a-f]{64}$/.test(sourceFiles[0].sha256),
    `${label}: per-file sha256 is 64-char hex`,
  );

  // Combined hash
  assertTrue(
    /^[0-9a-f]{64}$/.test(cert["combinedSha256"] as string),
    `${label}: combinedSha256 is 64-char hex`,
  );

  // Eight properties
  const properties = cert["properties"] as Array<{ id: string }>;
  assertTrue(
    Array.isArray(properties) && properties.length === 8,
    `${label}: 8 properties`,
  );

  const expectedIds = [
    "no-buffer-overflows",
    "no-null-dereferences",
    "no-integer-overflow",
    "no-division-by-zero",
    "no-modulo-by-zero",
    "no-data-races",
    "no-use-after-free",
    "no-undefined-control-flow",
  ];
  for (const id of expectedIds) {
    assertTrue(
      properties.some((p) => p.id === id),
      `${label}: property '${id}' present`,
    );
  }

  // Compilation outcome
  const outcome = cert["compilationOutcome"] as {
    success: boolean;
    diagnosticCodes: string[];
  };
  assertEq(outcome.success, true, `${label}: outcome.success`);
  assertEq(outcome.diagnosticCodes.length, 0, `${label}: no diagnostic codes`);

  // certifies / doesNotCertify strings
  assertTrue(
    typeof cert["certifies"] === "string" &&
      (cert["certifies"] as string).length > 0,
    `${label}: certifies present`,
  );
  assertTrue(
    typeof cert["doesNotCertify"] === "string" &&
      (cert["doesNotCertify"] as string).length > 0,
    `${label}: doesNotCertify present`,
  );

  console.log(`${label}: PASS`);
}

// ---------------------------------------------------------------------------
// Test 2: .typ file is written alongside the JSON
// ---------------------------------------------------------------------------
{
  const label = "typst-file-written";
  const certPath = path.join(outDir, "success.cert.json");
  const typPath = certPath.replace(/\.json$/, ".typ");

  assertTrue(
    fs.existsSync(typPath),
    `${label}: .typ file exists at ${typPath}`,
  );
  const typContent = fs.readFileSync(typPath, "utf8");
  assertTrue(
    typContent.includes("Tuff Verification Certificate"),
    `${label}: .typ contains document title`,
  );
  assertTrue(
    typContent.includes("No Buffer Overflows"),
    `${label}: .typ contains property names`,
  );

  console.log(`${label}: PASS`);
}

// ---------------------------------------------------------------------------
// Test 3: compilation failure still writes certificate with success === false
// ---------------------------------------------------------------------------
{
  const label = "failure-certificate";

  // Write a .tuff source that contains a deliberate type error (safe syntax error)
  const badSrc = path.join(outDir, "bad.tuff");
  fs.writeFileSync(
    badSrc,
    'fn main() -> i32 {\n  let x: i32 = "not a number";\n  return x;\n}\n',
    "utf8",
  );

  const certPath = path.join(outDir, "failure.cert.json");
  const r = runCliExpectError([badSrc, "--emit-certificate", certPath], label);
  void r;

  const cert = readCert(certPath);
  const outcome = cert["compilationOutcome"] as {
    success: boolean;
    diagnosticCodes: string[];
  };
  assertEq(outcome.success, false, `${label}: outcome.success is false`);

  console.log(`${label}: PASS`);
}

// ---------------------------------------------------------------------------
// Test 4: missing value for --emit-certificate is reported clearly
// ---------------------------------------------------------------------------
{
  const label = "missing-value";
  const r = runCliExpectError(
    ["./src/test/tuff/cases/factorial.tuff", "--emit-certificate"],
    label,
  );
  assertTrue(
    `${r.stdout ?? ""}\n${r.stderr ?? ""}`.includes(
      "Missing value for --emit-certificate",
    ),
    `${label}: error message`,
  );
  console.log(`${label}: PASS`);
}

console.log("certificate: all tests passed");
