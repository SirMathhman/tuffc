import { TuffError } from "./errors.js";

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

function named(type) {
  if (!type) return null;
  if (typeof type === "string") return type;
  if (type.kind === "NamedType") return type.name;
  if (type.kind === "RefinementType") return named(type.base);
  if (type.kind === "UnionType")
    return `${named(type.left)}|${named(type.right)}`;
  if (type.kind === "ArrayType") return "Array";
  if (type.kind === "PointerType") return "Pointer";
  if (type.kind === "TupleType") return "Tuple";
  return null;
}

function i32Range() {
  return { min: -(2 ** 31), max: 2 ** 31 - 1 };
}

function cloneInfo(info) {
  return {
    name: info?.name ?? "Unknown",
    min: info?.min ?? null,
    max: info?.max ?? null,
    nonZero: !!info?.nonZero,
    arrayInit: info?.arrayInit ?? null,
    arrayTotal: info?.arrayTotal ?? null,
    unionTags: info?.unionTags ? [...info.unionTags] : null,
  };
}

function intersectBounds(info, fact) {
  const out = cloneInfo(info);
  if (fact.min !== undefined && fact.min !== null) {
    out.min = out.min === null ? fact.min : Math.max(out.min, fact.min);
  }
  if (fact.max !== undefined && fact.max !== null) {
    out.max = out.max === null ? fact.max : Math.min(out.max, fact.max);
  }
  if (fact.nonZero) out.nonZero = true;
  if (out.min !== null && out.max !== null && out.min > out.max) {
    // Reset bounds if contradictory (rather than throw error)
    out.min = null;
    out.max = null;
  }
  if (out.min !== null && out.max !== null && (out.min > 0 || out.max < 0)) {
    out.nonZero = true;
  }
  return out;
}

function literalNumber(expr) {
  return expr?.kind === "NumberLiteral" ? expr.value : null;
}

export function typecheck(ast, options = {}) {
  const strictSafety = !!options.strictSafety;

  const structs = new Map();
  const enums = new Map();
  const functions = new Map();
  const typeAliases = new Map();

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
    if (!type) return { name: "Unknown", min: null, max: null, nonZero: false };
    if (typeof type === "string")
      return { name: type, min: null, max: null, nonZero: false };

    if (type.kind === "NamedType") {
      const base = { name: type.name, min: null, max: null, nonZero: false };
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
        base.unionTags = aliasInfo.unionTags ?? null;
      }
      return base;
    }

    if (type.kind === "RefinementType") {
      const base = resolveTypeInfo(type.base, seenAliases);
      const lit = literalNumber(type.valueExpr);
      if (lit !== null) {
        if (type.op === "!=" && lit === 0) {
          base.nonZero = true;
        }
        if (type.op === "<")
          base.max = base.max === null ? lit - 1 : Math.min(base.max, lit - 1);
        if (type.op === "<=")
          base.max = base.max === null ? lit : Math.min(base.max, lit);
        if (type.op === ">")
          base.min = base.min === null ? lit + 1 : Math.max(base.min, lit + 1);
        if (type.op === ">=")
          base.min = base.min === null ? lit : Math.max(base.min, lit);
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
        min: null,
        max: null,
        nonZero: false,
        unionTags: [...new Set(tags)],
      };
    }

    if (type.kind === "ArrayType") {
      return {
        name: "Array",
        min: null,
        max: null,
        nonZero: false,
        arrayInit: literalNumber(type.init),
        arrayTotal: literalNumber(type.total),
      };
    }

    if (type.kind === "PointerType") {
      const inner = resolveTypeInfo(type.to, seenAliases);
      return { ...inner, name: `*${inner.name}` };
    }

    return {
      name: named(type) ?? "Unknown",
      min: null,
      max: null,
      nonZero: false,
    };
  };

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
      return actualInfo.min !== null && actualInfo.min >= 0;
    }
    return true;
  };

  const inferExpr = (expr, scope, facts) => {
    switch (expr.kind) {
      case "NumberLiteral":
        return {
          name: "I32",
          min: expr.value,
          max: expr.value,
          nonZero: expr.value !== 0,
        };
      case "BoolLiteral":
        return { name: "Bool", min: null, max: null, nonZero: false };
      case "StringLiteral":
        return { name: "*Str", min: null, max: null, nonZero: false };
      case "CharLiteral":
        return { name: "Char", min: null, max: null, nonZero: false };
      case "Identifier": {
        if (scope.has(expr.name)) {
          const base = cloneInfo(scope.get(expr.name));
          const fact = facts.get(expr.name);
          return fact ? intersectBounds(base, fact) : base;
        }
        if (functions.has(expr.name))
          return { name: "Fn", min: null, max: null, nonZero: false };
        if (structs.has(expr.name))
          return { name: expr.name, min: null, max: null, nonZero: false };
        if (enums.has(expr.name))
          return { name: expr.name, min: null, max: null, nonZero: false };
        return { name: "Unknown", min: null, max: null, nonZero: false };
      }
      case "StructInit": {
        const s = structs.get(expr.name);
        if (!s) throw new TuffError(`Unknown struct '${expr.name}'`, expr.loc);
        const fieldMap = new Map(s.fields.map((f) => [f.name, f]));
        for (const f of expr.fields) {
          if (!fieldMap.has(f.key))
            throw new TuffError(
              `Unknown field '${f.key}' for struct ${expr.name}`,
              expr.loc,
            );
          inferExpr(f.value, scope, facts);
        }
        return { name: expr.name, min: null, max: null, nonZero: false };
      }
      case "UnaryExpr": {
        const t = inferExpr(expr.expr, scope, facts);
        if (expr.op === "!" && t.name !== "Bool" && t.name !== "Unknown")
          throw new TuffError("'!' expects Bool", expr.loc);
        if (expr.op === "-" && !NUMERIC.has(t.name) && t.name !== "Unknown")
          throw new TuffError("Unary '-' expects numeric type", expr.loc);
        if (expr.op === "-") {
          return {
            ...t,
            min: t.max === null ? null : -t.max,
            max: t.min === null ? null : -t.min,
          };
        }
        return { name: "Bool", min: null, max: null, nonZero: false };
      }
      case "BinaryExpr": {
        const l = inferExpr(expr.left, scope, facts);
        const r = inferExpr(expr.right, scope, facts);
        if (["+", "-", "*", "/", "%"].includes(expr.op)) {
          // Allow Unknown types to pass through (needed for bootstrap)
          const lOk = NUMERIC.has(l.name) || l.name === "Unknown";
          const rOk = NUMERIC.has(r.name) || r.name === "Unknown";
          if (!lOk || !rOk)
            throw new TuffError(
              `Operator ${expr.op} expects numeric operands`,
              expr.loc,
            );

          if (strictSafety && expr.op === "/" && !r.nonZero) {
            throw new TuffError(
              "Division by zero cannot be ruled out at compile time",
              expr.loc,
              {
                code: "E_SAFETY_DIV_BY_ZERO",
                hint: "Prove denominator != 0 via refinement type or control-flow guard.",
              },
            );
          }

          const out = { name: l.name, min: null, max: null, nonZero: false };
          if (
            l.min !== null &&
            l.max !== null &&
            r.min !== null &&
            r.max !== null
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
            if (out.min === null || out.max === null) {
              throw new TuffError(
                `Cannot prove overflow safety for '${expr.op}'`,
                expr.loc,
                {
                  code: "E_SAFETY_OVERFLOW_UNPROVEN",
                  hint: "Add range checks or widen arithmetic before narrowing.",
                },
              );
            }
            if (out.min < i32.min || out.max > i32.max) {
              throw new TuffError(
                `Integer overflow/underflow proven possible for '${expr.op}'`,
                expr.loc,
                {
                  code: "E_SAFETY_OVERFLOW",
                  hint: "Constrain operands or use a larger intermediate numeric type.",
                },
              );
            }
          }
          if (strictSafety && expr.op === "%" && !r.nonZero) {
            throw new TuffError(
              "Modulo by zero cannot be ruled out at compile time",
              expr.loc,
              {
                code: "E_SAFETY_MOD_BY_ZERO",
                hint: "Prove modulo divisor != 0 via guard or refinement.",
              },
            );
          }
          if (
            out.min !== null &&
            out.max !== null &&
            (out.min > 0 || out.max < 0)
          ) {
            out.nonZero = true;
          }
          return out;
        }
        if (["==", "!=", "<", "<=", ">", ">="].includes(expr.op)) {
          return { name: "Bool", min: null, max: null, nonZero: false };
        }
        if (["&&", "||"].includes(expr.op)) {
          const lOk = l.name === "Bool" || l.name === "Unknown";
          const rOk = r.name === "Bool" || r.name === "Unknown";
          if (!lOk || !rOk)
            throw new TuffError(
              `Operator ${expr.op} expects Bool operands`,
              expr.loc,
            );
          return { name: "Bool", min: null, max: null, nonZero: false };
        }
        return { name: "Unknown", min: null, max: null, nonZero: false };
      }
      case "CallExpr": {
        if (expr.callee.kind === "Identifier") {
          const fn = functions.get(expr.callee.name);
          if (fn) {
            // Skip strict type checking for extern functions
            const isExtern = fn.kind === "ExternFnDecl";
            if (!isExtern && expr.args.length !== fn.params.length) {
              throw new TuffError(
                `Function ${fn.name} expects ${fn.params.length} args, got ${expr.args.length}`,
                expr.loc,
              );
            }
            if (!isExtern) {
              for (let idx = 0; idx < expr.args.length; idx++) {
                const argType = inferExpr(expr.args[idx], scope, facts);
                const expectedInfo = resolveTypeInfo(fn.params[idx].type);
                const expected = expectedInfo.name ?? argType.name;
                if (
                  expected &&
                  argType.name !== "Unknown" &&
                  expected !== argType.name &&
                  !areCompatibleNumericTypes(expected, argType.name, argType) &&
                  !typeAliases.has(expected)
                ) {
                  throw new TuffError(
                    `Type mismatch in call to ${fn.name} arg ${idx + 1}: expected ${expected}, got ${argType.name}`,
                    expr.loc,
                  );
                }

                if (strictSafety && expectedInfo.nonZero && !argType.nonZero) {
                  throw new TuffError(
                    `Call to ${fn.name} requires arg ${idx + 1} to be proven non-zero`,
                    expr.loc,
                  );
                }
              }
            } else {
              // Still infer types for extern call arguments
              expr.args.forEach((a) => inferExpr(a, scope, facts));
            }
            return resolveTypeInfo(fn.returnType);
          }
        }
        expr.args.forEach((a) => inferExpr(a, scope, facts));
        return { name: "Unknown", min: null, max: null, nonZero: false };
      }
      case "MemberExpr": {
        const t = inferExpr(expr.object, scope, facts);
        if (expr.property === "length" || expr.property === "init") {
          const max = t.arrayTotal ?? t.arrayInit ?? null;
          return { name: "USize", min: 0, max, nonZero: false };
        }
        return { name: "Unknown", min: null, max: null, nonZero: false };
      }
      case "IndexExpr": {
        const target = inferExpr(expr.target, scope, facts);
        const index = inferExpr(expr.index, scope, facts);
        if (strictSafety && target.arrayInit !== null) {
          if (index.max === null) {
            throw new TuffError(
              "Cannot prove array index bound safety",
              expr.loc,
              {
                code: "E_SAFETY_ARRAY_BOUNDS_UNPROVEN",
                hint: "Guard index with 'if (i < arr.length)' before indexing.",
              },
            );
          }
          if (index.max >= target.arrayInit || index.min < 0) {
            throw new TuffError("Array index may be out of bounds", expr.loc, {
              code: "E_SAFETY_ARRAY_BOUNDS",
              hint: "Ensure 0 <= index < initialized length.",
            });
          }
        }
        return { name: "Unknown", min: null, max: null, nonZero: false };
      }
      case "IfExpr": {
        const cond = inferExpr(expr.condition, scope, facts);
        if (cond.name !== "Bool" && cond.name !== "Unknown")
          throw new TuffError(
            "if condition must be Bool",
            expr.condition?.loc ?? expr.loc,
          );
        const thenFacts = mergeFacts(facts, deriveFacts(expr.condition, true));
        const elseFacts = mergeFacts(facts, deriveFacts(expr.condition, false));
        const a = inferNode(expr.thenBranch, new Map(scope), thenFacts);
        const b = expr.elseBranch
          ? inferNode(expr.elseBranch, new Map(scope), elseFacts)
          : a;
        return a.name === b.name
          ? a
          : { name: "Unknown", min: null, max: null, nonZero: false };
      }
      case "MatchExpr": {
        const target = inferExpr(expr.target, scope, facts);
        const seen = new Set();
        let hasWildcard = false;
        for (const c of expr.cases) {
          if (c.pattern.kind === "WildcardPattern") hasWildcard = true;
          if (c.pattern.kind === "NamePattern") seen.add(c.pattern.name);
          if (c.pattern.kind === "StructPattern") seen.add(c.pattern.name);
          inferNode(c.body, new Map(scope), new Map(facts));
        }
        if (strictSafety && target.unionTags?.length && !hasWildcard) {
          for (const tag of target.unionTags) {
            if (!seen.has(tag)) {
              throw new TuffError(
                `Non-exhaustive match: missing case for ${tag}`,
                expr.loc,
                {
                  code: "E_MATCH_NON_EXHAUSTIVE",
                  hint: "Add missing case arms or a wildcard case '_'.",
                },
              );
            }
          }
        }
        return { name: "Unknown", min: null, max: null, nonZero: false };
      }
      case "IsExpr":
        inferExpr(expr.expr, scope, facts);
        return { name: "Bool", min: null, max: null, nonZero: false };
      case "UnwrapExpr":
        return inferExpr(expr.expr, scope, facts);
      default:
        return { name: "Unknown", min: null, max: null, nonZero: false };
    }
  };

  const inferNode = (node, scope, facts, expectedReturn = null) => {
    switch (node.kind) {
      case "Block": {
        let last = { name: "Void", min: null, max: null, nonZero: false };
        const local = new Map(scope);
        const localFacts = new Map(facts);
        for (const s of node.statements)
          last = inferNode(s, local, localFacts, expectedReturn);
        return last;
      }
      case "LetDecl": {
        const valueType = inferExpr(node.value, scope, facts);
        const expectedInfo = node.type ? resolveTypeInfo(node.type) : null;
        const expected = expectedInfo?.name ?? null;
        if (
          expected &&
          valueType.name !== "Unknown" &&
          expected !== valueType.name &&
          !areCompatibleNumericTypes(expected, valueType.name, valueType) &&
          !typeAliases.has(expected)
        ) {
          throw new TuffError(
            `Type mismatch for let ${node.name}: expected ${expected}, got ${valueType.name}`,
            node.loc,
          );
        }
        if (strictSafety && expectedInfo?.nonZero && !valueType.nonZero) {
          throw new TuffError(
            `Cannot prove non-zero refinement for ${node.name}`,
            node.loc,
          );
        }
        const stored = expectedInfo
          ? intersectBounds(expectedInfo, valueType)
          : valueType;
        scope.set(node.name, stored);
        return { name: "Void", min: null, max: null, nonZero: false };
      }
      case "AssignStmt": {
        const value = inferExpr(node.value, scope, facts);
        if (node.target.kind === "Identifier") {
          const t = scope.get(node.target.name);
          if (t && value.name !== "Unknown" && t.name !== value.name)
            throw new TuffError(
              `Assignment mismatch for ${node.target.name}: expected ${t.name}, got ${value.name}`,
              node.loc ?? node.target?.loc,
            );
          if (t) scope.set(node.target.name, intersectBounds(t, value));
        }
        return { name: "Void", min: null, max: null, nonZero: false };
      }
      case "ExprStmt":
        return inferExpr(node.expr, scope, facts);
      case "ReturnStmt": {
        const t = node.value
          ? inferExpr(node.value, scope, facts)
          : { name: "Void", min: null, max: null, nonZero: false };
        if (
          expectedReturn &&
          expectedReturn.name !== "Unknown" &&
          t.name !== "Unknown" &&
          expectedReturn.name !== t.name
        ) {
          throw new TuffError(
            `Return type mismatch: expected ${expectedReturn.name}, got ${t.name}`,
            node.loc,
          );
        }
        if (strictSafety && expectedReturn?.nonZero && !t.nonZero) {
          throw new TuffError(
            "Return value does not satisfy non-zero refinement",
            node.loc,
          );
        }
        return t;
      }
      case "IfStmt": {
        const cond = inferExpr(node.condition, scope, facts);
        if (cond.name !== "Bool" && cond.name !== "Unknown")
          throw new TuffError(
            "if condition must be Bool",
            node.condition?.loc ?? node.loc,
          );
        const thenFacts = mergeFacts(facts, deriveFacts(node.condition, true));
        const elseFacts = mergeFacts(facts, deriveFacts(node.condition, false));
        inferNode(node.thenBranch, new Map(scope), thenFacts, expectedReturn);
        if (node.elseBranch)
          inferNode(node.elseBranch, new Map(scope), elseFacts, expectedReturn);
        return { name: "Void", min: null, max: null, nonZero: false };
      }
      case "ForStmt":
        scope.set(node.iterator, {
          name: "I32",
          min: 0,
          max: null,
          nonZero: false,
        });
        inferExpr(node.start, scope, facts);
        inferExpr(node.end, scope, facts);
        inferNode(node.body, new Map(scope), new Map(facts), expectedReturn);
        return { name: "Void", min: null, max: null, nonZero: false };
      case "WhileStmt":
        inferExpr(node.condition, scope, facts);
        inferNode(node.body, new Map(scope), new Map(facts), expectedReturn);
        return { name: "Void", min: null, max: null, nonZero: false };
      case "FnDecl": {
        const fnScope = new Map();
        const fnFacts = new Map();
        for (const p of node.params) {
          fnScope.set(p.name, resolveTypeInfo(p.type));
        }
        const expectedInfo = resolveTypeInfo(node.returnType);
        const bodyType =
          node.body.kind === "Block"
            ? inferNode(node.body, fnScope, fnFacts, expectedInfo)
            : inferExpr(node.body, fnScope, fnFacts);
        const expected = expectedInfo.name;
        if (
          expected &&
          bodyType.name !== "Unknown" &&
          bodyType.name !== "Void" &&
          bodyType.name !== expected
        ) {
          throw new TuffError(
            `Function ${node.name} return type mismatch: expected ${expected}, got ${bodyType.name}`,
            node.loc,
          );
        }
        return { name: "Void", min: null, max: null, nonZero: false };
      }
      default:
        return { name: "Void", min: null, max: null, nonZero: false };
    }
  };

  for (const node of ast.body) {
    inferNode(node, new Map(), new Map());
  }

  return ast;
}
