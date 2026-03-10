import { err, ok } from "../../commonMain/types";
import type { Result } from "../../commonMain/types";
import type {
  ModuleNode,
  ProjectCompileInput,
} from "../../commonMain/compiler/core/ast";
import {
  createModuleResultName,
  getProjectCompilationOrder,
} from "../../commonMain/compiler/core/project";
import { createScopeFrame } from "../../commonMain/compiler/core/scope";
import { tokenize } from "../../commonMain/compiler/core/tokenization";
import {
  createParser,
  parseAndValidateProgram,
  parseProjectModule,
} from "../../commonMain/compiler";
import {
  codegenExternalProviderHelpers,
  codegenExternalProviderLoad,
  codegenProgramReturn,
  codegenRuntimeHelpers,
  generateStatementCode,
} from "./codegen";

export function compile(input: string): Result<string, string> {
  const DEBUG = false;

  if (DEBUG) console.log("[COMPILE START]", input.substring(0, 100));

  if (input === "") {
    return ok("return 0;");
  }

  if (input !== input.trim()) {
    return err("Leading or trailing whitespace is not allowed");
  }

  if (DEBUG) console.log("[TOKENIZE]");
  const tokenResult = tokenize(input);
  if (!tokenResult.ok) {
    return tokenResult;
  }

  const parser = createParser(tokenResult.value, createScopeFrame(undefined));

  if (DEBUG) console.log("[PRESCAN]");
  if (DEBUG) console.log("[PARSE PROGRAM]");
  const astResult = parseAndValidateProgram(parser);
  if (!astResult.ok) {
    return astResult;
  }

  return ok(
    codegenRuntimeHelpers() + " " + codegenProgramReturn(astResult.value),
  );
}

export function compileProject(
  input: ProjectCompileInput,
): Result<string, string> {
  const compilationOrder = getProjectCompilationOrder(input);
  if (!compilationOrder.ok) {
    return compilationOrder;
  }

  const reachableModules = new Map(
    compilationOrder.value.map((moduleInfo) => [
      moduleInfo.moduleName,
      moduleInfo,
    ]),
  );

  const moduleNodes: ModuleNode[] = [];
  for (const moduleInfo of compilationOrder.value) {
    const moduleAst = parseProjectModule(moduleInfo, reachableModules);
    if (!moduleAst.ok) {
      return moduleAst;
    }
    moduleNodes.push(moduleAst.value);
  }

  const entryModule = compilationOrder.value.find(
    (moduleInfo) => moduleInfo.moduleName === input.entryModule,
  );
  if (!entryModule) {
    return err("Unknown module '" + input.entryModule + "'");
  }

  const externalProviderModules = compilationOrder.value.filter(
    (moduleInfo) => moduleInfo.externModuleName && moduleInfo.externalProvider,
  );
  const externalPrelude =
    externalProviderModules.length > 0
      ? codegenExternalProviderHelpers() +
        " " +
        externalProviderModules
          .map((moduleInfo) =>
            codegenExternalProviderLoad(
              moduleInfo.externalProvider?.runtimeName ?? "",
              moduleInfo.externalProvider?.source ?? "",
            ),
          )
          .join(" ") +
        " "
      : "";

  return ok(
    externalPrelude +
      codegenRuntimeHelpers() +
      " " +
      generateStatementCode(moduleNodes) +
      " return " +
      createModuleResultName(entryModule.runtimeName) +
      ";",
  );
}

export const compileTuffToJS = compile;

export { parseProjectModule } from "../../commonMain/compiler";
export type { ModuleCompilationInfo } from "../../commonMain/compiler/core/ast";
