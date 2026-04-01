const source =
  'import { get } from "./lib"; export function wrapper() { return get(); }';
const otherModules = { lib: { get: () => 4 } };
const exportedNames = [];
const otherLines = [];
for (const line of source.split("\n")) {
  const t = line.trim();
  if (t.startsWith("export function ")) {
    const afterExport = t.slice("export ".length);
    const nameEnd = afterExport.indexOf("(");
    exportedNames.push(afterExport.slice("function ".length, nameEnd).trim());
    otherLines.push(afterExport);
  } else if (t.startsWith("import {")) {
    const fromIndex = t.indexOf(" from ");
    let rawRef = t.slice(fromIndex + 6).trim();
    if (rawRef[0] === '"') rawRef = rawRef.slice(1);
    if (rawRef[rawRef.length - 1] === '"') rawRef = rawRef.slice(0, -1);
    const moduleRef = rawRef.startsWith("./") ? rawRef.slice(2) : rawRef;
    const importedNamesRaw = t.slice(t.indexOf("{") + 1, t.indexOf("}"));
    for (const name of importedNamesRaw.split(",").map((s) => s.trim())) {
      otherLines.push(
        "const " +
          name +
          " = __importedModules." +
          moduleRef +
          "." +
          name +
          ";",
      );
    }
  } else {
    otherLines.push(line);
  }
}
const ea = exportedNames
  .map((n) => "__exports." + n + " = " + n + ";")
  .join("\n");
const body = otherLines.join("\n") + "\n" + ea;
console.log("BODY:", JSON.stringify(body));
const fn = new Function("__exports", "__importedModules", body);
const exp = {};
fn(exp, otherModules);
console.log("wrapper():", exp.wrapper());
