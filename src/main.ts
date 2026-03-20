import { compile } from "./compiler";

export async function main(args: string[] = process.argv.slice(2)): Promise<number> {
  const parsed = parseCliArguments(args);
  if (parsed === undefined) {
    return 1;
  }

  const input = Bun.file(parsed.inputPath);
  if (!(await input.exists())) {
    console.error(`Input file not found: ${parsed.inputPath}`);
    return 1;
  }

  const source = await input.text();
  const result = compile(source);

  if (result.diagnostics.length > 0) {
    for (const diagnostic of result.diagnostics) {
      console.error(`${parsed.inputPath}:${diagnostic.line}:${diagnostic.column}: ${diagnostic.message}`);
    }

    return 1;
  }

  await Bun.write(parsed.outputPath, result.output);
  console.info(parsed.outputPath);
  return 0;
}

if (import.meta.main) {
  void main().then((code) => {
    process.exitCode = code;
  });
}

interface CliArguments {
  inputPath: string;
  outputPath: string;
}

function parseCliArguments(args: string[]): CliArguments | undefined {
  if (args.length === 0) {
    console.error("Usage: bun run src/main.ts <input.tuff> [-o output.ts]");
    return undefined;
  }

  const inputPath = args[0];
  let outputPath = replaceExtension(inputPath, ".ts");

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];

    if ((arg === "-o" || arg === "--out") && index + 1 < args.length) {
      outputPath = args[index + 1];
      index += 1;
      continue;
    }
  }

  return { inputPath, outputPath };
}

function replaceExtension(filePath: string, extension: string): string {
  const lastDot = filePath.lastIndexOf(".");
  return lastDot >= 0 ? `${filePath.slice(0, lastDot)}${extension}` : `${filePath}${extension}`;
}
