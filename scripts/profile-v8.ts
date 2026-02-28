/**
 * V8 CPU profiler for the Tuff selfhost compiler.
 * Uses the inspector protocol to capture a CPU profile, then summarizes the hottest functions.
 */
import path from "path";
import { fileURLToPath } from "url";
import { Session } from "inspector/promises";
import { selfhostPaths, selfhostCompileOptions } from "./profile-shared.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  // Dynamic import to avoid circular issues
  const { compileFileResult } = await import("../src/main/js/compiler.js");

  const { inputPath, outputPath, moduleBaseDir } = selfhostPaths(__dirname);
  const opts = selfhostCompileOptions(moduleBaseDir);

  const session = new Session();
  session.connect();

  await session.post("Profiler.enable");
  await session.post("Profiler.start");

  console.log("Compiling selfhost.tuff with V8 CPU profiler...");
  const wallStart = performance.now();
  const result = compileFileResult(inputPath, outputPath, opts);
  const wallElapsed = performance.now() - wallStart;
  console.log(`Wall time: ${wallElapsed.toFixed(1)}ms (ok=${result.ok})`);

  const { profile } = await session.post("Profiler.stop");
  session.disconnect();

  // Aggregate self time by function
  type FnEntry = {
    name: string;
    url: string;
    line: number;
    selfTime: number;
    totalHits: number;
  };
  const fnMap = new Map<string, FnEntry>();
  const nodes = profile.nodes;
  const timeDeltas = profile.timeDeltas ?? [];
  const samples = profile.samples ?? [];

  // Build node lookup
  const nodeById = new Map<number, (typeof nodes)[0]>();
  for (const node of nodes) {
    nodeById.set(node.id, node);
  }

  // Accumulate sample times to nodes
  const selfTimeById = new Map<number, number>();
  for (let i = 0; i < samples.length; i++) {
    const nodeId = samples[i];
    const delta = i < timeDeltas.length ? timeDeltas[i] : 0;
    selfTimeById.set(nodeId, (selfTimeById.get(nodeId) ?? 0) + delta);
  }

  // Group by function name + url + line
  for (const [nodeId, selfTime] of selfTimeById) {
    const node = nodeById.get(nodeId);
    if (!node) continue;
    const cf = node.callFrame;
    const key = `${cf.functionName}|${cf.url}|${cf.lineNumber}`;
    const existing = fnMap.get(key);
    if (existing) {
      existing.selfTime += selfTime;
      existing.totalHits++;
    } else {
      fnMap.set(key, {
        name: cf.functionName || "(anonymous)",
        url: cf.url,
        line: cf.lineNumber + 1,
        selfTime,
        totalHits: 1,
      });
    }
  }

  // Sort by self time descending
  const sorted = [...fnMap.values()].sort((a, b) => b.selfTime - a.selfTime);

  const totalSelfTime = sorted.reduce((s, f) => s + f.selfTime, 0);
  console.log(
    `\nTotal profiled self-time: ${(totalSelfTime / 1000).toFixed(1)}ms`,
  );
  console.log(`\n=== Top 40 Functions by Self Time ===`);
  console.log(
    `${"#".padStart(3)} ${"Self(ms)".padStart(10)} ${"Pct".padStart(6)} ${"Hits".padStart(6)}  Function`,
  );

  let cumPct = 0;
  for (let i = 0; i < Math.min(40, sorted.length); i++) {
    const f = sorted[i];
    const selfMs = f.selfTime / 1000;
    const pct = (f.selfTime / totalSelfTime) * 100;
    cumPct += pct;
    const shortUrl = f.url.replace(/.*[/\\]Tuffc[/\\]/, "");
    console.log(
      `${String(i + 1).padStart(3)} ${selfMs.toFixed(1).padStart(10)} ${pct.toFixed(1).padStart(5)}% ${String(f.totalHits).padStart(6)}  ${f.name} (${shortUrl}:${f.line})`,
    );
  }
  console.log(`\nTop 40 cumulative: ${cumPct.toFixed(1)}%`);

  // Also save full profile to disk for chrome devtools
  const fs = await import("fs");
  fs.writeFileSync(
    path.resolve(__dirname, "../tests/out/build/selfhost-cpu.cpuprofile"),
    JSON.stringify(profile),
  );
  console.log(
    "\nFull profile saved to tests/out/build/selfhost-cpu.cpuprofile",
  );
  console.log("(Open in Chrome DevTools → Performance tab → Load profile)");
}

main().catch(console.error);
