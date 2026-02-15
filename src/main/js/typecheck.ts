// @ts-nocheck
import { TuffError } from "./errors.ts";
import { err, ok, type Result } from "./result.ts";

type TypecheckResult<T> = Result<T, TuffError>;

const NUMERIC = new Set([
  "I8",
  "I16",
  "I32",
  "I64",
  "I128",
  "U8",
  "U16",
  "U32",
  "U64",
  "U128",
  "USize",
  "ISize",
  "F32",
  "F64",
]);

const UNSIGNED = new Set(["U8", "U16", "U32", "U64", "U128", "USize"]);

function isTypeVariableName(name) {
  return typeof name === "string" && /^[A-Z]$/.test(name);
}

function areCompatibleNamedTypes(expected, actual) {
  if (expected === actual) return true;

  if (typeof expected === "string" && expected.includes("|")) {
    const parts = expected.split("|").map((p) => p.trim());
    if (parts.includes(actual)) return true;
  }

  // Mutable pointer can be used where immutable pointer is expected.
  // expected: *T, actual: *mut T  => allowed
  if (
    typeof expected === "string" &&
    typeof actual === "string" &&
    expected.startsWith("*") &&
    !expected.startsWith("*mut ") &&
    actual.startsWith("*mut ")
  ) {
    const expectedInner = expected.slice(1);
    const actualInner = actual.slice(5);
    return expectedInner === actualInner;
  }

  return false;
}

function named(type) {
  if (!type) return undefined;
  if (typeof type === "string") return type;
  if (type.kind === "NamedType") return type.name;
  if (type.kind === "RefinementType") return named(type.base);
  if (type.kind === "UnionType")
    return `${named(type.left)}|${named(type.right)}`;
  if (type.kind === "ArrayType") return "Array";
  if (type.kind === "PointerType") {
    const inner = named(type.to) ?? "Unknown";
    return type.mutable ? `*mut ${inner}` : `*${inner}`;
  }
  if (type.kind === "TupleType") return "Tuple";
  return undefined;
}

function i32Range() {
  return { min: -(2 ** 31), max: 2 ** 31 - 1 };
}

function cloneInfo(info) {
  return {
    name: info?.name ?? "Unknown",
    min: info?.min ?? undefined,
    max: info?.max ?? undefined,
    nonZero: !!info?.nonZero,
    arrayInit: info?.arrayInit ?? undefined,
    arrayTotal: info?.arrayTotal ?? undefined,
    unionTags: info?.unionTags ? [...info.unionTags] : undefined,
    typeNode: info?.typeNode ?? undefined,
  };
}

function intersectBounds(info, fact) {
  const out = cloneInfo(info);
  if (fact.nonNullPointer) {
    const pointerBranch = getNullablePointerBranch(out.typeNode);
    if (pointerBranch) {
      out.typeNode = pointerBranch;
      out.name = named(pointerBranch) ?? out.name;
      out.nonZero = true;
    }
  }
  if (fact.min !== undefined && fact.min !== undefined) {
    out.min = out.min === undefined ? fact.min : Math.max(out.min, fact.min);
  }
  if (fact.max !== undefined && fact.max !== undefined) {
    out.max = out.max === undefined ? fact.max : Math.min(out.max, fact.max);
  }
  if (fact.nonZero) out.nonZero = true;
  if (out.min !== undefined && out.max !== undefined && out.min > out.max) {
    // Reset bounds if contradictory (rather than throw error)
    out.min = undefined;
    out.max = undefined;
  }
  if (
    out.min !== undefined &&
    out.max !== undefined &&
    (out.min > 0 || out.max < 0)
  ) {
    out.nonZero = true;
  }
  return out;
}

function substituteType(type, bindings) {
  if (!type) return type;

  if (type.kind === "NamedType") {
    if (
      (!type.genericArgs || type.genericArgs.length === 0) &&
      bindings.has(type.name)
    ) {
      return bindings.get(type.name);
    }
    return {
      ...type,
      genericArgs: (type.genericArgs ?? []).map((g) =>
        substituteType(g, bindings),
      ),
    };
  }

  if (type.kind === "PointerType") {
    return { ...type, to: substituteType(type.to, bindings) };
  }

  if (type.kind === "ArrayType") {
    return { ...type, element: substituteType(type.element, bindings) };
  }

  if (type.kind === "TupleType") {
    return {
      ...type,
      members: (type.members ?? []).map((m) => substituteType(m, bindings)),
    };
  }

  if (type.kind === "RefinementType") {
    return { ...type, base: substituteType(type.base, bindings) };
  }

  if (type.kind === "UnionType") {
    return {
      ...type,
      left: substituteType(type.left, bindings),
      right: substituteType(type.right, bindings),
    };
  }

  return type;
}

function bindGenericsFromTypes(paramType, argType, genericNames, bindings) {
  if (!paramType || !argType) return;

  if (paramType.kind === "NamedType") {
    const pArgs = paramType.genericArgs ?? [];
    if (pArgs.length === 0 && genericNames.has(paramType.name)) {
      if (!bindings.has(paramType.name)) {
        bindings.set(paramType.name, argType);
      }
      return;
    }

    if (argType.kind === "NamedType" && argType.name === paramType.name) {
      const aArgs = argType.genericArgs ?? [];
      const len = Math.min(pArgs.length, aArgs.length);
      for (let i = 0; i < len; i++) {
        bindGenericsFromTypes(pArgs[i], aArgs[i], genericNames, bindings);
      }
    }
    return;
  }

  if (paramType.kind === "PointerType" && argType.kind === "PointerType") {
    bindGenericsFromTypes(paramType.to, argType.to, genericNames, bindings);
    return;
  }

  if (paramType.kind === "ArrayType" && argType.kind === "ArrayType") {
    bindGenericsFromTypes(
      paramType.element,
      argType.element,
      genericNames,
      bindings,
    );
    return;
  }

  if (paramType.kind === "TupleType" && argType.kind === "TupleType") {
    const pMembers = paramType.members ?? [];
    const aMembers = argType.members ?? [];
    const len = Math.min(pMembers.length, aMembers.length);
    for (let i = 0; i < len; i++) {
      bindGenericsFromTypes(pMembers[i], aMembers[i], genericNames, bindings);
    }
    return;
  }

  if (paramType.kind === "RefinementType") {
    bindGenericsFromTypes(paramType.base, argType, genericNames, bindings);
  }
}

function collectTypeVariables(type, knownTypeNames, out) {
  if (!type) return;

  if (type.kind === "NamedType") {
    const args = type.genericArgs ?? [];
    if (args.length === 0 && !knownTypeNames.has(type.name)) {
      out.add(type.name);
      return;
    }
    for (const arg of args) {
      collectTypeVariables(arg, knownTypeNames, out);
    }
    return;
  }

  if (type.kind === "PointerType") {
    collectTypeVariables(type.to, knownTypeNames, out);
    return;
  }

  if (type.kind === "ArrayType") {
    collectTypeVariables(type.element, knownTypeNames, out);
    return;
  }

  if (type.kind === "TupleType") {
    for (const member of type.members ?? []) {
      collectTypeVariables(member, knownTypeNames, out);
    }
    return;
  }

  if (type.kind === "RefinementType") {
    collectTypeVariables(type.base, knownTypeNames, out);
    return;
  }

  if (type.kind === "UnionType") {
    collectTypeVariables(type.left, knownTypeNames, out);
    collectTypeVariables(type.right, knownTypeNames, out);
  }
}

function literalNumber(expr) {
  return expr?.kind === "NumberLiteral" ? expr.value : undefined;
}

function isUSizeZeroLiteralExpr(expr) {
  return (
    expr?.kind === "NumberLiteral" &&
    Number(expr?.value) === 0 &&
    expr?.numberType === "USize"
  );
}

function isUSizeZeroTypeNode(typeNode) {
  if (!typeNode || typeNode.kind !== "RefinementType") return false;
  if (typeNode.op !== "==") return false;
  if (typeNode.base?.kind !== "NamedType" || typeNode.base?.name !== "USize")
    return false;
  return isUSizeZeroLiteralExpr(typeNode.valueExpr);
}

function getNullablePointerBranch(typeNode) {
  if (!typeNode || typeNode.kind !== "UnionType") return undefined;
  const left = typeNode.left;
  const right = typeNode.right;
  if (left?.kind === "PointerType" && isUSizeZeroTypeNode(right)) return left;
  if (right?.kind === "PointerType" && isUSizeZeroTypeNode(left)) return right;
  return undefined;
}

function isNullablePointerInfo(info) {
  return !!getNullablePointerBranch(info?.typeNode);
}

export function typecheck(
  ast: { body: unknown[] },
  options: Record<string, unknown> = {},
): TypecheckResult<{ body: unknown[] }> {
  // Safety checks are always enforced for user programs.
  // Internal bootstrap can opt out temporarily via a private flag.
  const strictSafety = options.__bootstrapRelaxed === true ? false : true;

  const structs = new Map();
  const enums = new Map();
  const functions = new Map();
  const typeAliases = new Map();
  const globalScope = new Map();

  for (const node of ast.body) {
    if (node.kind === "StructDecl") {
      structs.set(node.name, node);
    } else if (node.kind === "EnumDecl") {
      enums.set(node.name, node);
    } else if (node.kind === "FnDecl" || node.kind === "ExternFnDecl") {
      functions.set(node.name, node);
    } else if (node.kind === "TypeAlias" || node.kind === "ExternTypeDecl") {
      typeAliases.set(
        node.name,
        node.aliasedType ?? { kind: "NamedType", name: "Unknown" },
      );
    }
  }

  const resolveTypeInfo = (type, seenAliases = new Set()) => {
    if (!type)
      return {
        name: "Unknown",
        min: undefined,
        max: undefined,
        nonZero: false,
      };
    if (typeof type === "string")
      return {
        name: type,
        min: undefined,
        max: undefined,
        nonZero: false,
        typeNode: undefined,
      };

    if (type.kind === "NamedType") {
      const base = {
        name: type.name,
        min: undefined,
        max: undefined,
        nonZero: false,
      };
      if (type.name === "I32") {
        const r = i32Range();
        base.min = r.min;
        base.max = r.max;
      }
      if (UNSIGNED.has(type.name)) {
        base.min = 0;
      }
      if (typeAliases.has(type.name) && !seenAliases.has(type.name)) {
        seenAliases.add(type.name);
        const aliasInfo = resolveTypeInfo(
          typeAliases.get(type.name),
          seenAliases,
        );
        base.unionTags = aliasInfo.unionTags ?? undefined;
      }
      base.typeNode = type;
      return base;
    }

    if (type.kind === "RefinementType") {
      const base = resolveTypeInfo(type.base, seenAliases);
      const lit = literalNumber(type.valueExpr);
      if (lit !== undefined) {
        if (type.op === "!=" && lit === 0) {
          base.nonZero = true;
        }
        if (type.op === "<")
          base.max =
            base.max === undefined ? lit - 1 : Math.min(base.max, lit - 1);
        if (type.op === "<=")
          base.max = base.max === undefined ? lit : Math.min(base.max, lit);
        if (type.op === ">")
          base.min =
            base.min === undefined ? lit + 1 : Math.max(base.min, lit + 1);
        if (type.op === ">=")
          base.min = base.min === undefined ? lit : Math.max(base.min, lit);
      }
      return base;
    }

    if (type.kind === "UnionType") {
      const left = resolveTypeInfo(type.left, seenAliases);
      const right = resolveTypeInfo(type.right, seenAliases);
      const tags = [];
      if (left.name && left.name !== "Unknown") tags.push(left.name);
      if (right.name && right.name !== "Unknown") tags.push(right.name);
      return {
        name: `${left.name}|${right.name}`,
        min: undefined,
        max: undefined,
        nonZero: false,
        unionTags: [...new Set(tags)],
        typeNode: type,
      };
    }

    if (type.kind === "ArrayType") {
      return {
        name: "Array",
        min: undefined,
        max: undefined,
        nonZero: false,
        arrayInit: literalNumber(type.init),
        arrayTotal: literalNumber(type.total),
        typeNode: type,
      };
    }

    if (type.kind === "PointerType") {
      const inner = resolveTypeInfo(type.to, seenAliases);
      const pointerName = type.mutable
        ? `*mut ${inner.name}`
        : `*${inner.name}`;
      return {
        ...inner,
        name: pointerName,
        typeNode: type,
      };
    }

    return {
      name: named(type) ?? "Unknown",
      min: undefined,
      max: undefined,
      nonZero: false,
      typeNode: type,
    };
  };

  for (const node of ast.body) {
    if (
      (node.kind === "LetDecl" || node.kind === "ExternLetDecl") &&
      node.type
    ) {
      globalScope.set(node.name, resolveTypeInfo(node.type));
    }
  }

  const deriveFacts = (expr, assumeTrue) => {
    const facts = new Map();

    const addFact = (name, patch) => {
      const prev = facts.get(name) ?? {};
      facts.set(name, { ...prev, ...patch });
    };

    const fromComparison = (left, op, right) => {
      if (left.kind === "Identifier" && right.kind === "NumberLiteral") {
        const v = right.value;
        if (op === "<") addFact(left.name, { max: v - 1 });
        if (op === "<=") addFact(left.name, { max: v });
        if (op === ">") addFact(left.name, { min: v + 1 });
        if (op === ">=") addFact(left.name, { min: v });
        if (op === "==")
          addFact(left.name, { min: v, max: v, nonZero: v !== 0 });
        if (op === "!=" && v === 0) addFact(left.name, { nonZero: true });
        if (op === "!=" && isUSizeZeroLiteralExpr(right)) {
          addFact(left.name, { nonNullPointer: true });
        }
      }

      if (left.kind === "NumberLiteral" && right.kind === "Identifier") {
        if (op === "!=" && isUSizeZeroLiteralExpr(left)) {
          addFact(right.name, { nonNullPointer: true });
        }
      }
    };

    const visit = (node, truthy) => {
      if (!node) return;
      if (node.kind === "BinaryExpr") {
        if (node.op === "&&") {
          if (truthy) {
            visit(node.left, true);
            visit(node.right, true);
          }
          return;
        }
        if (node.op === "||") {
          if (!truthy) {
            visit(node.left, false);
            visit(node.right, false);
          }
          return;
        }

        const effectiveOp = truthy
          ? node.op
          : ({
              "<": ">=",
              "<=": ">",
              ">": "<=",
              ">=": "<",
              "==": "!=",
              "!=": "==",
            }[node.op] ?? node.op);
        fromComparison(node.left, effectiveOp, node.right);
      }
    };

    visit(expr, assumeTrue);
    return facts;
  };

  const mergeFacts = (baseFacts, extraFacts) => {
    const out = new Map(baseFacts);
    for (const [name, patch] of extraFacts.entries()) {
      const prev = out.get(name) ?? {};
      out.set(name, { ...prev, ...patch });
    }
    return out;
  };

  const areCompatibleNumericTypes = (expected, actual, actualInfo) => {
    if (expected === actual) return true;
    if (!NUMERIC.has(expected) || !NUMERIC.has(actual)) return false;
    if (UNSIGNED.has(expected)) {
      return actualInfo.min !== undefined && actualInfo.min >= 0;
    }
    return true;
  };

  const inferExpr = (expr, scope, facts): TypecheckResult<unknown> => {
    switch (expr.kind) {
      case "NumberLiteral": {
        const numberName = expr.numberType === "USize" ? "USize" : "I32";
        return ok({
          name: numberName,
          min: expr.value,
          max: expr.value,
          nonZero: expr.value !== 0,
          typeNode: {
            kind: "NamedType",
            name: numberName,
            genericArgs: [],
          },
        });
      }
      case "BoolLiteral":
        return ok({
          name: "Bool",
          min: undefined,
          max: undefined,
          nonZero: false,
        });
      case "StringLiteral":
        return ok({
          name: "*Str",
          min: undefined,
          max: undefined,
          nonZero: false,
        });
      case "CharLiteral":
        return ok({
          name: "Char",
          min: undefined,
          max: undefined,
          nonZero: false,
        });
      case "Identifier": {
        if (scope.has(expr.name)) {
          const base = cloneInfo(scope.get(expr.name));
          const fact = facts.get(expr.name);
          return ok(fact ? intersectBounds(base, fact) : base);
        }
        if (globalScope.has(expr.name)) {
          return ok(cloneInfo(globalScope.get(expr.name)));
        }
        if (functions.has(expr.name))
          return ok({
            name: "Fn",
            min: undefined,
            max: undefined,
            nonZero: false,
          });
        if (structs.has(expr.name))
          return ok({
            name: expr.name,
            min: undefined,
            max: undefined,
            nonZero: false,
          });
        if (enums.has(expr.name))
          return ok({
            name: expr.name,
            min: undefined,
            max: undefined,
            nonZero: false,
          });
        return ok({
          name: "Unknown",
          min: undefined,
          max: undefined,
          nonZero: false,
        });
      }
      case "StructInit": {
        const s = structs.get(expr.name);
        if (!s)
          return err(new TuffError(`Unknown struct '${expr.name}'`, expr.loc));
        const fieldMap = new Map(s.fields.map((f) => [f.name, f]));
        for (const f of expr.fields) {
          if (!fieldMap.has(f.key))
            return err(
              new TuffError(
                `Unknown field '${f.key}' for struct ${expr.name}`,
                expr.loc,
              ),
            );
          const inferResult = inferExpr(f.value, scope, facts);
          if (!inferResult.ok) return inferResult;
        }
        return ok({
          name: expr.name,
          min: undefined,
          max: undefined,
          nonZero: false,
        });
      }
      case "UnaryExpr": {
        const tResult = inferExpr(expr.expr, scope, facts);
        if (!tResult.ok) return tResult;
        const t = tResult.value;
        if (expr.op === "&" || expr.op === "&mut") {
          const pointerName =
            expr.op === "&mut" ? `*mut ${t.name}` : `*${t.name}`;
          return ok({
            name: pointerName,
            min: undefined,
            max: undefined,
            nonZero: true,
            typeNode: {
              kind: "PointerType",
              mutable: expr.op === "&mut",
              to: t.typeNode ?? {
                kind: "NamedType",
                name: t.name,
                genericArgs: [],
              },
            },
          });
        }
        if (expr.op === "!" && t.name !== "Bool" && t.name !== "Unknown")
          return err(new TuffError("'!' expects Bool", expr.loc));
        if (expr.op === "-" && !NUMERIC.has(t.name) && t.name !== "Unknown")
          return err(new TuffError("Unary '-' expects numeric type", expr.loc));
        if (expr.op === "-") {
          return ok({
            ...t,
            min: t.max === undefined ? undefined : -t.max,
            max: t.min === undefined ? undefined : -t.min,
          });
        }
        return ok({
          name: "Bool",
          min: undefined,
          max: undefined,
          nonZero: false,
        });
      }
      case "BinaryExpr": {
        const lResult = inferExpr(expr.left, scope, facts);
        if (!lResult.ok) return lResult;
        const l = lResult.value;
        const rResult = inferExpr(expr.right, scope, facts);
        if (!rResult.ok) return rResult;
        const r = rResult.value;
        if (["+", "-", "*", "/", "%"].includes(expr.op)) {
          // Allow Unknown types to pass through (needed for bootstrap)
          const lOk = NUMERIC.has(l.name) || l.name === "Unknown";
          const rOk = NUMERIC.has(r.name) || r.name === "Unknown";
          if (!lOk || !rOk)
            return err(
              new TuffError(
                `Operator ${expr.op} expects numeric operands`,
                expr.loc,
              ),
            );

          if (strictSafety && expr.op === "/" && !r.nonZero) {
            return err(
              new TuffError(
                "Division by zero cannot be ruled out at compile time",
                expr.loc,
                {
                  code: "E_SAFETY_DIV_BY_ZERO",
                  hint: "Prove denominator != 0 via refinement type or control-flow guard.",
                },
              ),
            );
          }

          const out = {
            name: l.name,
            min: undefined,
            max: undefined,
            nonZero: false,
          };
          if (
            l.min !== undefined &&
            l.max !== undefined &&
            r.min !== undefined &&
            r.max !== undefined
          ) {
            if (expr.op === "+") {
              out.min = l.min + r.min;
              out.max = l.max + r.max;
            } else if (expr.op === "-") {
              out.min = l.min - r.max;
              out.max = l.max - r.min;
            } else if (expr.op === "*") {
              const cands = [
                l.min * r.min,
                l.min * r.max,
                l.max * r.min,
                l.max * r.max,
              ];
              out.min = Math.min(...cands);
              out.max = Math.max(...cands);
            }
          }

          if (strictSafety && ["+", "-", "*"].includes(expr.op)) {
            const i32 = i32Range();
            const leftLit = literalNumber(expr.left);
            const rightLit = literalNumber(expr.right);
            if (typeof leftLit === "number" && typeof rightLit === "number") {
              let result = 0;
              if (expr.op === "+") {
                result = leftLit + rightLit;
              } else if (expr.op === "-") {
                result = leftLit - rightLit;
              } else {
                result = leftLit * rightLit;
              }
              if (result < i32.min || result > i32.max) {
                return err(
                  new TuffError(
                    `Integer overflow/underflow proven possible for '${expr.op}'`,
                    expr.loc,
                    {
                      code: "E_SAFETY_OVERFLOW",
                      hint: "Constrain operands or use a larger intermediate numeric type.",
                    },
                  ),
                );
              }
            }
          }
          if (strictSafety && expr.op === "%" && !r.nonZero) {
            return err(
              new TuffError(
                "Modulo by zero cannot be ruled out at compile time",
                expr.loc,
                {
                  code: "E_SAFETY_MOD_BY_ZERO",
                  hint: "Prove modulo divisor != 0 via guard or refinement.",
                },
              ),
            );
          }
          if (
            out.min !== undefined &&
            out.max !== undefined &&
            (out.min > 0 || out.max < 0)
          ) {
            out.nonZero = true;
          }
          return ok(out);
        }
        if (["==", "!=", "<", "<=", ">", ">="].includes(expr.op)) {
          return ok({
            name: "Bool",
            min: undefined,
            max: undefined,
            nonZero: false,
          });
        }
        if (["&&", "||"].includes(expr.op)) {
          const lOk = l.name === "Bool" || l.name === "Unknown";
          const rOk = r.name === "Bool" || r.name === "Unknown";
          if (!lOk || !rOk)
            return err(
              new TuffError(
                `Operator ${expr.op} expects Bool operands`,
                expr.loc,
              ),
            );
          return ok({
            name: "Bool",
            min: undefined,
            max: undefined,
            nonZero: false,
          });
        }
        return ok({
          name: "Unknown",
          min: undefined,
          max: undefined,
          nonZero: false,
        });
      }
      case "CallExpr": {
        if (expr.callee.kind === "Identifier") {
          const fn = functions.get(expr.callee.name);
          if (fn) {
            const argTypes = [];
            for (const a of expr.args) {
              const argResult = inferExpr(a, scope, facts);
              if (!argResult.ok) return argResult;
              argTypes.push(argResult.value);
            }

            const genericBindings = new Map();
            const genericNames = new Set(fn.generics ?? []);
            const knownTypeNames = new Set([
              ...typeAliases.keys(),
              ...structs.keys(),
              ...enums.keys(),
              "I8",
              "I16",
              "I32",
              "I64",
              "I128",
              "U8",
              "U16",
              "U32",
              "U64",
              "U128",
              "USize",
              "ISize",
              "F32",
              "F64",
              "Bool",
              "Char",
              "AnyValue",
              "Void",
              "Unknown",
            ]);
            for (const p of fn.params ?? []) {
              collectTypeVariables(p.type, knownTypeNames, genericNames);
            }
            collectTypeVariables(fn.returnType, knownTypeNames, genericNames);
            for (let idx = 0; idx < expr.args.length; idx++) {
              const paramType = fn.params[idx]?.type;
              const argTypeNode = argTypes[idx]?.typeNode;
              if (paramType && argTypeNode && genericNames.size > 0) {
                bindGenericsFromTypes(
                  paramType,
                  argTypeNode,
                  genericNames,
                  genericBindings,
                );
              }
            }

            const resolvedReturnType = substituteType(
              fn.returnType,
              genericBindings,
            );

            if (expr.args.length !== fn.params.length) {
              return err(
                new TuffError(
                  `Function ${fn.name} expects ${fn.params.length} args, got ${expr.args.length}`,
                  expr.loc,
                ),
              );
            }
            for (let idx = 0; idx < expr.args.length; idx++) {
              const argType = argTypes[idx];
              const expectedInfo = resolveTypeInfo(fn.params[idx].type);
              const expected = expectedInfo.name ?? argType.name;
              if (
                strictSafety &&
                expected?.startsWith("*") &&
                isNullablePointerInfo(argType)
              ) {
                return err(
                  new TuffError(
                    `Call to ${fn.name} arg ${idx + 1} requires nullable pointer guard`,
                    expr.loc,
                    {
                      code: "E_SAFETY_NULLABLE_POINTER_GUARD",
                      hint: "Guard pointer use with if (p != 0USize) (or 0USize != p) before dereference/consumption.",
                    },
                  ),
                );
              }
              if (
                expected &&
                argType.name !== "Unknown" &&
                !areCompatibleNamedTypes(expected, argType.name) &&
                !isTypeVariableName(expected) &&
                !isTypeVariableName(argType.name) &&
                !areCompatibleNumericTypes(expected, argType.name, argType) &&
                !typeAliases.has(expected)
              ) {
                return err(
                  new TuffError(
                    `Type mismatch in call to ${fn.name} arg ${idx + 1}: expected ${expected}, got ${argType.name}`,
                    expr.loc,
                  ),
                );
              }

              if (strictSafety && expectedInfo.nonZero && !argType.nonZero) {
                return err(
                  new TuffError(
                    `Call to ${fn.name} requires arg ${idx + 1} to be proven non-zero`,
                    expr.loc,
                  ),
                );
              }
            }
            return ok(resolveTypeInfo(resolvedReturnType));
          }
        }
        for (const a of expr.args) {
          const argResult = inferExpr(a, scope, facts);
          if (!argResult.ok) return argResult;
        }
        return ok({
          name: "Unknown",
          min: undefined,
          max: undefined,
          nonZero: false,
        });
      }
      case "MemberExpr": {
        const tResult = inferExpr(expr.object, scope, facts);
        if (!tResult.ok) return tResult;
        const t = tResult.value;
        if (strictSafety && isNullablePointerInfo(t)) {
          return err(
            new TuffError("Nullable pointer access requires guard", expr.loc, {
              code: "E_SAFETY_NULLABLE_POINTER_GUARD",
              hint: "Use if (p != 0USize) or if (0USize != p) before accessing members.",
            }),
          );
        }
        if (expr.property === "length" || expr.property === "init") {
          const max = t.arrayTotal ?? t.arrayInit ?? undefined;
          return ok({ name: "USize", min: 0, max, nonZero: false });
        }
        return ok({
          name: "Unknown",
          min: undefined,
          max: undefined,
          nonZero: false,
        });
      }
      case "IndexExpr": {
        const targetResult = inferExpr(expr.target, scope, facts);
        if (!targetResult.ok) return targetResult;
        const target = targetResult.value;
        if (strictSafety && isNullablePointerInfo(target)) {
          return err(
            new TuffError(
              "Nullable pointer indexing requires guard",
              expr.loc,
              {
                code: "E_SAFETY_NULLABLE_POINTER_GUARD",
                hint: "Use if (p != 0USize) or if (0USize != p) before indexing through pointers.",
              },
            ),
          );
        }
        const indexResult = inferExpr(expr.index, scope, facts);
        if (!indexResult.ok) return indexResult;
        const index = indexResult.value;
        if (strictSafety && target.arrayInit !== undefined) {
          if (index.max === undefined) {
            return err(
              new TuffError("Cannot prove array index bound safety", expr.loc, {
                code: "E_SAFETY_ARRAY_BOUNDS_UNPROVEN",
                hint: "Guard index with 'if (i < arr.length)' before indexing.",
              }),
            );
          }
          if (index.max >= target.arrayInit || index.min < 0) {
            return err(
              new TuffError("Array index may be out of bounds", expr.loc, {
                code: "E_SAFETY_ARRAY_BOUNDS",
                hint: "Ensure 0 <= index < initialized length.",
              }),
            );
          }
        }
        return ok({
          name: "Unknown",
          min: undefined,
          max: undefined,
          nonZero: false,
        });
      }
      case "IfExpr": {
        const condResult = inferExpr(expr.condition, scope, facts);
        if (!condResult.ok) return condResult;
        const cond = condResult.value;
        if (cond.name !== "Bool" && cond.name !== "Unknown")
          return err(
            new TuffError(
              "if condition must be Bool",
              expr.condition?.loc ?? expr.loc,
            ),
          );
        const thenFacts = mergeFacts(facts, deriveFacts(expr.condition, true));
        const elseFacts = mergeFacts(facts, deriveFacts(expr.condition, false));
        const aResult = inferNode(expr.thenBranch, new Map(scope), thenFacts);
        if (!aResult.ok) return aResult;
        const a = aResult.value;
        if (expr.elseBranch) {
          const bResult = inferNode(expr.elseBranch, new Map(scope), elseFacts);
          if (!bResult.ok) return bResult;
          const b = bResult.value;
          return ok(
            a.name === b.name
              ? a
              : {
                  name: "Unknown",
                  min: undefined,
                  max: undefined,
                  nonZero: false,
                },
          );
        }
        return ok(a);
      }
      case "MatchExpr": {
        const targetResult = inferExpr(expr.target, scope, facts);
        if (!targetResult.ok) return targetResult;
        const target = targetResult.value;
        const seen = new Set();
        let hasWildcard = false;
        for (const c of expr.cases) {
          if (c.pattern.kind === "WildcardPattern") hasWildcard = true;
          if (c.pattern.kind === "NamePattern") seen.add(c.pattern.name);
          if (c.pattern.kind === "StructPattern") seen.add(c.pattern.name);
          const bodyResult = inferNode(c.body, new Map(scope), new Map(facts));
          if (!bodyResult.ok) return bodyResult;
        }
        if (strictSafety && target.unionTags?.length && !hasWildcard) {
          for (const tag of target.unionTags) {
            if (!seen.has(tag)) {
              return err(
                new TuffError(
                  `Non-exhaustive match: missing case for ${tag}`,
                  expr.loc,
                  {
                    code: "E_MATCH_NON_EXHAUSTIVE",
                    hint: "Add missing case arms or a wildcard case '_'.",
                  },
                ),
              );
            }
          }
        }
        return ok({
          name: "Unknown",
          min: undefined,
          max: undefined,
          nonZero: false,
        });
      }
      case "IsExpr": {
        const exprResult = inferExpr(expr.expr, scope, facts);
        if (!exprResult.ok) return exprResult;
        return ok({
          name: "Bool",
          min: undefined,
          max: undefined,
          nonZero: false,
        });
      }
      case "UnwrapExpr":
        return inferExpr(expr.expr, scope, facts);
      default:
        return ok({
          name: "Unknown",
          min: undefined,
          max: undefined,
          nonZero: false,
        });
    }
  };

  const inferNode = (
    node,
    scope,
    facts,
    expectedReturn = undefined,
  ): TypecheckResult<unknown> => {
    switch (node.kind) {
      case "Block": {
        let last = {
          name: "Void",
          min: undefined,
          max: undefined,
          nonZero: false,
        };
        const local = new Map(scope);
        const localFacts = new Map(facts);
        for (const s of node.statements) {
          const result = inferNode(s, local, localFacts, expectedReturn);
          if (!result.ok) return result;
          last = result.value;
        }
        return ok(last);
      }
      case "LetDecl": {
        const valueTypeResult = inferExpr(node.value, scope, facts);
        if (!valueTypeResult.ok) return valueTypeResult;
        const valueType = valueTypeResult.value;
        const expectedInfo = node.type ? resolveTypeInfo(node.type) : undefined;
        const expected = expectedInfo?.name ?? undefined;
        if (
          expected &&
          valueType.name !== "Unknown" &&
          !areCompatibleNamedTypes(expected, valueType.name) &&
          !isTypeVariableName(expected) &&
          !isTypeVariableName(valueType.name) &&
          !areCompatibleNumericTypes(expected, valueType.name, valueType) &&
          !typeAliases.has(expected)
        ) {
          return err(
            new TuffError(
              `Type mismatch for let ${node.name}: expected ${expected}, got ${valueType.name}`,
              node.loc,
            ),
          );
        }
        if (strictSafety && expectedInfo?.nonZero && !valueType.nonZero) {
          return err(
            new TuffError(
              `Cannot prove non-zero refinement for ${node.name}`,
              node.loc,
            ),
          );
        }
        const stored = expectedInfo
          ? intersectBounds(expectedInfo, valueType)
          : valueType;
        scope.set(node.name, stored);
        return ok({
          name: "Void",
          min: undefined,
          max: undefined,
          nonZero: false,
        });
      }
      case "AssignStmt": {
        const valueResult = inferExpr(node.value, scope, facts);
        if (!valueResult.ok) return valueResult;
        const value = valueResult.value;
        if (node.target.kind === "Identifier") {
          const t = scope.get(node.target.name);
          if (
            t &&
            value.name !== "Unknown" &&
            !areCompatibleNamedTypes(t.name, value.name) &&
            !isTypeVariableName(t.name) &&
            !isTypeVariableName(value.name)
          )
            return err(
              new TuffError(
                `Assignment mismatch for ${node.target.name}: expected ${t.name}, got ${value.name}`,
                node.loc ?? node.target?.loc,
              ),
            );
          if (t) scope.set(node.target.name, intersectBounds(t, value));
        }
        return ok({
          name: "Void",
          min: undefined,
          max: undefined,
          nonZero: false,
        });
      }
      case "ExprStmt":
        return inferExpr(node.expr, scope, facts);
      case "ReturnStmt": {
        const tResult = node.value
          ? inferExpr(node.value, scope, facts)
          : ok({
              name: "Void",
              min: undefined,
              max: undefined,
              nonZero: false,
            });
        if (!tResult.ok) return tResult;
        const t = tResult.value;
        if (
          expectedReturn &&
          expectedReturn.name !== "Unknown" &&
          t.name !== "Unknown" &&
          !areCompatibleNamedTypes(expectedReturn.name, t.name) &&
          !isTypeVariableName(expectedReturn.name) &&
          !isTypeVariableName(t.name)
        ) {
          return err(
            new TuffError(
              `Return type mismatch: expected ${expectedReturn.name}, got ${t.name}`,
              node.loc,
            ),
          );
        }
        if (strictSafety && expectedReturn?.nonZero && !t.nonZero) {
          return err(
            new TuffError(
              "Return value does not satisfy non-zero refinement",
              node.loc,
            ),
          );
        }
        return ok(t);
      }
      case "IfStmt": {
        const condResult = inferExpr(node.condition, scope, facts);
        if (!condResult.ok) return condResult;
        const cond = condResult.value;
        if (cond.name !== "Bool" && cond.name !== "Unknown")
          return err(
            new TuffError(
              "if condition must be Bool",
              node.condition?.loc ?? node.loc,
            ),
          );
        const thenFacts = mergeFacts(facts, deriveFacts(node.condition, true));
        const elseFacts = mergeFacts(facts, deriveFacts(node.condition, false));
        const thenResult = inferNode(
          node.thenBranch,
          new Map(scope),
          thenFacts,
          expectedReturn,
        );
        if (!thenResult.ok) return thenResult;
        if (node.elseBranch) {
          const elseResult = inferNode(
            node.elseBranch,
            new Map(scope),
            elseFacts,
            expectedReturn,
          );
          if (!elseResult.ok) return elseResult;
        }
        return ok({
          name: "Void",
          min: undefined,
          max: undefined,
          nonZero: false,
        });
      }
      case "ForStmt": {
        scope.set(node.iterator, {
          name: "I32",
          min: 0,
          max: undefined,
          nonZero: false,
        });
        const startResult = inferExpr(node.start, scope, facts);
        if (!startResult.ok) return startResult;
        const endResult = inferExpr(node.end, scope, facts);
        if (!endResult.ok) return endResult;
        const bodyResult = inferNode(
          node.body,
          new Map(scope),
          new Map(facts),
          expectedReturn,
        );
        if (!bodyResult.ok) return bodyResult;
        return ok({
          name: "Void",
          min: undefined,
          max: undefined,
          nonZero: false,
        });
      }
      case "WhileStmt": {
        const condResult = inferExpr(node.condition, scope, facts);
        if (!condResult.ok) return condResult;
        const bodyResult = inferNode(
          node.body,
          new Map(scope),
          new Map(facts),
          expectedReturn,
        );
        if (!bodyResult.ok) return bodyResult;
        return ok({
          name: "Void",
          min: undefined,
          max: undefined,
          nonZero: false,
        });
      }
      case "FnDecl": {
        const fnScope = new Map(globalScope);
        const fnFacts = new Map();
        for (const p of node.params) {
          fnScope.set(p.name, resolveTypeInfo(p.type));
        }
        const expectedInfo = resolveTypeInfo(node.returnType);
        const bodyTypeResult =
          node.body.kind === "Block"
            ? inferNode(node.body, fnScope, fnFacts, expectedInfo)
            : inferExpr(node.body, fnScope, fnFacts);
        if (!bodyTypeResult.ok) return bodyTypeResult;
        const bodyType = bodyTypeResult.value;
        const expected = expectedInfo.name;
        if (
          expected &&
          bodyType.name !== "Unknown" &&
          bodyType.name !== "Void" &&
          !areCompatibleNamedTypes(expected, bodyType.name) &&
          !isTypeVariableName(expected) &&
          !isTypeVariableName(bodyType.name)
        ) {
          return err(
            new TuffError(
              `Function ${node.name} return type mismatch: expected ${expected}, got ${bodyType.name}`,
              node.loc,
            ),
          );
        }
        return ok({
          name: "Void",
          min: undefined,
          max: undefined,
          nonZero: false,
        });
      }
      default:
        return ok({
          name: "Void",
          min: undefined,
          max: undefined,
          nonZero: false,
        });
    }
  };

  for (const node of ast.body) {
    const result = inferNode(node, new Map(), new Map());
    if (!result.ok) return result;
  }

  return ok(ast);
}
