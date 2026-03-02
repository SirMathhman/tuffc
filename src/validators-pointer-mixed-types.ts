import { Result, CompileError, ok, err, createCompileError } from "./types";
import { forEachAddressOf } from "./extractors";

function checkMixedPointerTypes(source: string): Result<void, CompileError> {
  const varMap = new Map<string, { hasImmut: boolean; hasMut: boolean }>();
  forEachAddressOf(source, (varName, isMut) => {
    if (!varMap.has(varName)) {
      varMap.set(varName, { hasImmut: false, hasMut: false });
    }
    const info = varMap.get(varName)!;
    if (isMut) {
      info.hasMut = true;
    } else {
      info.hasImmut = true;
    }
  });

  for (const [varName, { hasImmut, hasMut }] of varMap) {
    if (hasImmut && hasMut) {
      return err(
        createCompileError(
          source,
          `Cannot mix immutable and mutable pointers for the same variable: '${varName}' has both '&${varName}' and '&mut ${varName}'`,
          "A variable can either have immutable pointers or mutable pointers, but not both at the same time",
          `Use only '&${varName}' for immutable references or only '&mut ${varName}' for mutable references`,
        ),
      );
    }
  }
  return ok(void 0);
}

export { checkMixedPointerTypes };
