import { compileTuffAndExecute } from "./compiler";

function main(): void {
  const tuffSource = "exit 0";
  const exitCode = compileTuffAndExecute(tuffSource);

  console.log(`Executed program exit code: ${exitCode}`);
}

main();
