// @ts-nocheck
import { TuffError } from "./errors.ts";
import { err, ok, type Result } from "./result.ts";

type Loc = { line?: number; column?: number; filePath?: string } | undefined;
type Token = {
  type: string;
  value: unknown;
  loc: Loc;
  start?: number;
  end?: number;
};
type Expr = Record<string, unknown>;
type Stmt = Record<string, unknown>;
type Program = { kind: "Program"; body: Stmt[] };
type ParseResult<T> = Result<T, TuffError>;

export function parse(tokens: Token[]): ParseResult<Program> {
  let i = 0;

  const peek = (n = 0): Token => tokens[i + n] ?? tokens[tokens.length - 1];
  const at = (type: string, value: unknown = undefined): boolean => {
    const t = peek();
    if (t.type !== type) return false;
    return value === undefined || t.value === value;
  };
  const eat = (): Token => tokens[i++];

  const expect = (
    type: string,
    value: unknown = undefined,
    message = "Unexpected token",
  ): ParseResult<Token> => {
    const t = peek();
    if (!at(type, value)) {
      return err(
        new TuffError(message + `, got ${t.type}:${t.value}`, t.loc, {
          code: "E_PARSE_EXPECTED_TOKEN",
          hint: "Check token order, punctuation, and delimiters around this location.",
        }),
      );
    }
    return ok(eat());
  };

  const parseIdentifierToken = (): ParseResult<Token> =>
    expect("identifier", undefined, "Expected identifier");

  const parseIdentifier = (): ParseResult<string> => {
    const result = parseIdentifierToken();
    if (!result.ok) return result;
    return ok(result.value.value as string);
  };

  const parseType = (): ParseResult<Expr> => {
    const canStartTypeToken = (tok: Token | undefined): boolean => {
      if (!tok) return false;
      if (tok.type === "identifier") return true;
      if (
        tok.type === "symbol" &&
        ["*", "[", "("].includes(tok.value as string)
      )
        return true;
      return false;
    };

    const canStartRefinementExpr = (tok: Token | undefined): boolean => {
      if (!tok) return false;
      if (["number", "identifier", "bool", "string", "char"].includes(tok.type))
        return true;
      if (
        tok.type === "symbol" &&
        ["(", "-", "!"].includes(tok.value as string)
      )
        return true;
      return false;
    };

    const numericTypeLiteralError = (
      kind: "invalid" | "unsupported",
      raw: string,
      loc: Loc,
    ) => {
      const message =
        kind === "invalid"
          ? `Invalid numeric type literal '${raw}'`
          : `Unsupported numeric type literal '${raw}'`;
      const hint =
        kind === "invalid"
          ? "Use 0USize as the nullable pointer sentinel in type unions."
          : "Only 0USize is valid as a type-level nullable pointer sentinel.";
      return err(
        new TuffError(message, loc, {
          code: "E_PARSE_INVALID_NUMERIC_TYPE_LITERAL",
          hint,
        }),
      );
    };

    const parseTypePrimary = (): ParseResult<Expr> => {
      if (at("symbol", "*")) {
        eat();
        let mutable = false;
        let move = false;
        let out = false;
        let uninit = false;
        let progressed = true;
        while (progressed) {
          progressed = false;
          if (!mutable && at("keyword", "mut")) {
            eat();
            mutable = true;
            progressed = true;
            continue;
          }
          if (!out && at("keyword", "out")) {
            eat();
            out = true;
            progressed = true;
            continue;
          }
          if (!uninit && at("keyword", "uninit")) {
            eat();
            uninit = true;
            progressed = true;
            continue;
          }
          if (!move && at("keyword", "move")) {
            eat();
            move = true;
            progressed = true;
            continue;
          }
        }
        const toResult = parseTypePrimary();
        if (!toResult.ok) return toResult;
        return ok({
          kind: "PointerType",
          mutable,
          move,
          out,
          uninit,
          to: toResult.value,
        });
      }

      if (at("symbol", "[")) {
        eat();
        const elementResult = parseType();
        if (!elementResult.ok) return elementResult;
        let init = undefined;
        let total = undefined;
        if (at("symbol", ";")) {
          eat();
          const initResult = parseExpression();
          if (!initResult.ok) return initResult;
          init = initResult.value;
          const semi = expect("symbol", ";", "Expected ';' in array type");
          if (!semi.ok) return semi;
          const totalResult = parseExpression();
          if (!totalResult.ok) return totalResult;
          total = totalResult.value;
        }
        const close = expect("symbol", "]", "Expected ']' after array type");
        if (!close.ok) return close;
        return ok({
          kind: "ArrayType",
          element: elementResult.value,
          init,
          total,
        });
      }

      if (at("symbol", "(")) {
        eat();
        const members: Expr[] = [];
        if (!at("symbol", ")")) {
          while (true) {
            if (peek()?.type === "identifier" && peek(1)?.value === ":") {
              eat(); // param name (ignored in function type)
              eat(); // ':'
            }
            const memberResult = parseType();
            if (!memberResult.ok) return memberResult;
            members.push(memberResult.value);
            if (!at("symbol", ",")) break;
            eat();
          }
        }
        const close = expect("symbol", ")", "Expected ')' for tuple type");
        if (!close.ok) return close;
        if (at("symbol", "=>")) {
          eat();
          const returnTypeResult = parseType();
          if (!returnTypeResult.ok) return returnTypeResult;
          return ok({
            kind: "FunctionType",
            params: members,
            returnType: returnTypeResult.value,
          });
        }
        return ok({ kind: "TupleType", members });
      }

      if (at("number")) {
        const t = eat();
        const raw = String(t.value ?? "");
        const match = raw.match(/^(-?\d+)([A-Za-z][A-Za-z0-9]*)?$/);
        if (!match) return numericTypeLiteralError("invalid", raw, t.loc);
        const value = Number(match[1]);
        const suffix = match[2] ?? undefined;
        if (suffix !== "USize" || value !== 0) {
          return numericTypeLiteralError("unsupported", raw, t.loc);
        }
        const base = { kind: "NamedType", name: "USize", genericArgs: [] };
        const valueExpr = {
          kind: "NumberLiteral",
          value: 0,
          numberType: "USize",
          loc: t.loc,
          start: t.start,
          end: t.end,
        };
        return ok({ kind: "RefinementType", base, op: "==", valueExpr });
      }

      const firstIdResult = expect(
        "identifier",
        undefined,
        "Expected type name",
      );
      if (!firstIdResult.ok) return firstIdResult;
      const nameParts = [firstIdResult.value.value as string];
      while (at("symbol", "::")) {
        eat();
        const partResult = parseIdentifier();
        if (!partResult.ok) return partResult;
        nameParts.push(partResult.value);
      }
      const genericArgs: Expr[] = [];
      const wouldBeMemberRefinement =
        at("symbol", "<") &&
        peek(1)?.type === "identifier" &&
        peek(2)?.type === "symbol" &&
        peek(2)?.value === ".";
      if (
        at("symbol", "<") &&
        canStartTypeToken(peek(1)) &&
        !wouldBeMemberRefinement
      ) {
        eat();
        if (!at("symbol", ">")) {
          while (true) {
            const argResult = parseType();
            if (!argResult.ok) return argResult;
            genericArgs.push(argResult.value);
            if (!at("symbol", ",")) break;
            eat();
          }
        }
        const close = expect("symbol", ">", "Expected '>' in generic args");
        if (!close.ok) return close;
      }

      return ok({
        kind: "NamedType",
        name: nameParts.join("::"),
        genericArgs,
      });
    };

    const primaryResult = parseTypePrimary();
    if (!primaryResult.ok) return primaryResult;
    let typeExpr: Expr = primaryResult.value;

    const startsGenericCallSuffix =
      at("symbol", ">") && peek(1)?.type === "symbol" && peek(1)?.value === "(";

    if (
      (at("symbol", "!=") ||
        at("symbol", "<") ||
        at("symbol", ">") ||
        at("symbol", "<=") ||
        at("symbol", ">=")) &&
      canStartRefinementExpr(peek(1)) &&
      !startsGenericCallSuffix
    ) {
      const op = eat().value as string;
      const valueExprResult = parseExpression();
      if (!valueExprResult.ok) return valueExprResult;
      typeExpr = {
        kind: "RefinementType",
        base: typeExpr,
        op,
        valueExpr: valueExprResult.value,
      };
    }

    while (at("symbol", "|") || at("symbol", "|>")) {
      const unionOp = eat().value as string;
      const rightResult = parseTypePrimary();
      if (!rightResult.ok) return rightResult;
      typeExpr = {
        kind: "UnionType",
        left: typeExpr,
        right: rightResult.value,
        extractFromLeft: unionOp === "|>",
      };
    }
    return ok(typeExpr);
  };

  const parseBlock = (): ParseResult<Stmt> => {
    const startResult = expect("symbol", "{", "Expected '{'");
    if (!startResult.ok) return startResult;
    const start = startResult.value.loc;
    const statements: Stmt[] = [];
    while (!at("symbol", "}") && !at("eof")) {
      const stmtResult = parseStatement();
      if (!stmtResult.ok) return stmtResult;
      statements.push(stmtResult.value);
    }
    const close = expect("symbol", "}", "Expected '}'");
    if (!close.ok) return close;
    return ok({ kind: "Block", statements, loc: start });
  };

  const parseGenericParams = (
    closeMessage = "Expected '>' after generics",
    constraintsOut: Record<string, Expr> | undefined = undefined,
  ): ParseResult<string[]> => {
    const generics: string[] = [];
    if (!at("symbol", "<")) {
      return ok(generics);
    }
    eat();
    if (!at("symbol", ">")) {
      while (true) {
        const genResult = parseIdentifier();
        if (!genResult.ok) return genResult;
        generics.push(genResult.value);
        if (at("symbol", ":")) {
          eat();
          const constraintResult = parseType();
          if (!constraintResult.ok) return constraintResult;
          if (constraintsOut) {
            constraintsOut[genResult.value] = constraintResult.value;
          }
        }
        if (!at("symbol", ",")) break;
        eat();
      }
    }
    const closeResult = expect("symbol", ">", closeMessage);
    if (!closeResult.ok) return closeResult;
    return ok(generics);
  };

  const parseTypedParams = (
    openMessage: string,
    closeMessage: string,
  ): ParseResult<{ name: string; type: Expr | undefined }[]> => {
    const openResult = expect("symbol", "(", openMessage);
    if (!openResult.ok) return openResult;
    const params: { name: string; type: Expr | undefined }[] = [];
    if (!at("symbol", ")")) {
      while (true) {
        const paramNameResult = parseIdentifier();
        if (!paramNameResult.ok) return paramNameResult;
        let paramType = undefined;
        if (at("symbol", ":")) {
          eat();
          const paramTypeResult = parseType();
          if (!paramTypeResult.ok) return paramTypeResult;
          paramType = paramTypeResult.value;
        }
        params.push({ name: paramNameResult.value, type: paramType });
        if (!at("symbol", ",")) break;
        eat();
      }
    }
    const closeResult = expect("symbol", ")", closeMessage);
    if (!closeResult.ok) return closeResult;
    return ok(params);
  };

  const parseOptionalReturnType = (): ParseResult<Expr | undefined> => {
    let returnType = undefined;
    if (at("symbol", ":")) {
      eat();
      const returnTypeResult = parseType();
      if (!returnTypeResult.ok) return returnTypeResult;
      returnType = returnTypeResult.value;
    }
    return ok(returnType);
  };

  const precedence: Record<string, number> = {
    "||": 1,
    "&&": 2,
    "==": 3,
    "!=": 3,
    "<": 4,
    "<=": 4,
    ">": 4,
    ">=": 4,
    is: 4,
    "+": 5,
    "-": 5,
    "*": 6,
    "/": 6,
    "%": 6,
  };

  const parsePattern = (): ParseResult<Expr> => {
    if (at("symbol", "_") || at("identifier", "_")) {
      eat();
      return ok({ kind: "WildcardPattern" });
    }
    if (at("number")) {
      const raw = String(eat().value ?? "");
      const match = raw.match(/^(-?\d+(?:\.\d+)?)/);
      return ok({
        kind: "LiteralPattern",
        value: Number(match?.[1] ?? raw),
      });
    }
    if (at("bool")) return ok({ kind: "LiteralPattern", value: !!eat().value });
    if (at("string")) return ok({ kind: "LiteralPattern", value: eat().value });

    const nameResult = parseIdentifier();
    if (!nameResult.ok) return nameResult;
    const name = nameResult.value;
    if (at("symbol", "{")) {
      eat();
      const fields: { field: string; bind: string }[] = [];
      if (!at("symbol", "}")) {
        while (true) {
          const fieldResult = parseIdentifier();
          if (!fieldResult.ok) return fieldResult;
          fields.push({ field: fieldResult.value, bind: fieldResult.value });
          if (!at("symbol", ",")) break;
          eat();
        }
      }
      const close = expect("symbol", "}", "Expected '}' in pattern");
      if (!close.ok) return close;
      return ok({ kind: "StructPattern", name, fields });
    }
    return ok({ kind: "NamePattern", name });
  };

  const parsePostfix = (baseExpr: Expr): ParseResult<Expr> => {
    let expr = baseExpr;
    while (true) {
      if (at("symbol", "<")) {
        const canStartTypeToken = (tok: Token | undefined): boolean => {
          if (!tok) return false;
          if (tok.type === "identifier") return true;
          if (
            tok.type === "symbol" &&
            ["*", "[", "("].includes(tok.value as string)
          )
            return true;
          return false;
        };

        const hasGenericCallSuffix = (): boolean => {
          if (!at("symbol", "<") || !canStartTypeToken(peek(1))) {
            return false;
          }
          let j = i;
          let depth = 0;
          while (j < tokens.length) {
            const t = tokens[j];
            if (t.type === "symbol" && t.value === "<") {
              depth += 1;
              j += 1;
              continue;
            }
            if (t.type === "symbol" && t.value === ">") {
              depth -= 1;
              j += 1;
              if (depth === 0) {
                const next = tokens[j];
                return next?.type === "symbol" && next?.value === "(";
              }
              continue;
            }
            if (t.type === "eof") return false;
            j += 1;
          }
          return false;
        };

        const hasGenericValueSuffix = (): boolean => {
          if (!at("symbol", "<") || !canStartTypeToken(peek(1))) {
            return false;
          }
          let j = i;
          let depth = 0;
          while (j < tokens.length) {
            const t = tokens[j];
            if (t.type === "symbol" && t.value === "<") {
              depth += 1;
              j += 1;
              continue;
            }
            if (t.type === "symbol" && t.value === ">") {
              depth -= 1;
              j += 1;
              if (depth === 0) {
                const next = tokens[j];
                return !(next?.type === "symbol" && next?.value === "(");
              }
              continue;
            }
            if (t.type === "eof") return false;
            j += 1;
          }
          return false;
        };

        if (
          expr.kind === "MemberExpr" &&
          expr.property === "into" &&
          hasGenericValueSuffix()
        ) {
          eat(); // '<'
          const typeArgs: Expr[] = [];
          if (!at("symbol", ">")) {
            while (true) {
              const typeArgResult = parseType();
              if (!typeArgResult.ok) return typeArgResult;
              typeArgs.push(typeArgResult.value);
              if (!at("symbol", ",")) break;
              eat();
            }
          }
          const closeGenericsResult = expect(
            "symbol",
            ">",
            "Expected '>' after into type args",
          );
          if (!closeGenericsResult.ok) return closeGenericsResult;
          const contractType = typeArgs.length === 1 ? typeArgs[0] : undefined;
          const contractName =
            contractType?.kind === "NamedType" &&
            (contractType.genericArgs ?? []).length === 0
              ? contractType.name
              : undefined;
          expr = {
            kind: "IntoValueExpr",
            value: expr.object,
            contractName,
            typeArgs,
            loc: expr.loc,
            start: expr.start,
            end: closeGenericsResult.value.end,
          };
          continue;
        }

        if (hasGenericCallSuffix()) {
          eat(); // '<'
          const typeArgs: Expr[] = [];
          if (!at("symbol", ">")) {
            while (true) {
              const typeArgResult = parseType();
              if (!typeArgResult.ok) return typeArgResult;
              typeArgs.push(typeArgResult.value);
              if (!at("symbol", ",")) break;
              eat();
            }
          }
          const closeGenericsResult = expect(
            "symbol",
            ">",
            "Expected '>' after generic call type args",
          );
          if (!closeGenericsResult.ok) return closeGenericsResult;

          const openCallResult = expect(
            "symbol",
            "(",
            "Expected '(' after generic call type args",
          );
          if (!openCallResult.ok) return openCallResult;

          const args: Expr[] = [];
          if (!at("symbol", ")")) {
            while (true) {
              const argResult = parseExpression();
              if (!argResult.ok) return argResult;
              args.push(argResult.value);
              if (!at("symbol", ",")) break;
              eat();
            }
          }
          const closeResult = expect(
            "symbol",
            ")",
            "Expected ')' after call args",
          );
          if (!closeResult.ok) return closeResult;
          const closeTok = closeResult.value;

          if (expr.kind === "MemberExpr") {
            expr = {
              kind: "CallExpr",
              callee: {
                kind: "Identifier",
                name: expr.property,
                loc: expr.loc,
              },
              args: [expr.object, ...args],
              typeArgs,
              loc: expr.loc,
              start: expr.start,
              end: closeTok.end,
              callStyle: "method-sugar",
            };
          } else {
            expr = {
              kind: "CallExpr",
              callee: expr,
              args,
              typeArgs,
              loc: expr.loc,
              start: expr.start,
              end: closeTok.end,
            };
          }
          continue;
        }
      }

      if (at("symbol", "(")) {
        eat();
        const args: Expr[] = [];
        if (!at("symbol", ")")) {
          while (true) {
            const argResult = parseExpression();
            if (!argResult.ok) return argResult;
            args.push(argResult.value);
            if (!at("symbol", ",")) break;
            eat();
          }
        }
        const closeResult = expect(
          "symbol",
          ")",
          "Expected ')' after call args",
        );
        if (!closeResult.ok) return closeResult;
        const closeTok = closeResult.value;

        if (expr.kind === "MemberExpr") {
          // Receiver-call sugar: value.method(a, b) => method(value, a, b)
          expr = {
            kind: "CallExpr",
            callee: {
              kind: "Identifier",
              name: expr.property,
              loc: expr.loc,
            },
            args: [expr.object, ...args],
            loc: expr.loc,
            start: expr.start,
            end: closeTok.end,
            callStyle: "method-sugar",
          };
        } else {
          expr = {
            kind: "CallExpr",
            callee: expr,
            args,
            loc: expr.loc,
            start: expr.start,
            end: closeTok.end,
          };
        }
        continue;
      }
      if (at("symbol", ".")) {
        eat();
        let propTok;
        if (at("identifier")) {
          const propResult = parseIdentifierToken();
          if (!propResult.ok) return propResult;
          propTok = propResult.value;
        } else if (at("keyword")) {
          propTok = eat();
        } else {
          return err(
            new TuffError(
              `Expected member name after '.', got ${peek().type}:${peek().value}`,
              peek().loc,
              {
                code: "E_PARSE_EXPECTED_TOKEN",
                hint: "Use an identifier-like member name after '.'.",
              },
            ),
          );
        }
        expr = {
          kind: "MemberExpr",
          object: expr,
          property: propTok.value,
          loc: expr.loc,
          start: expr.start,
          end: propTok.end,
        };
        continue;
      }
      if (at("symbol", "[")) {
        eat();
        const indexResult = parseExpression();
        if (!indexResult.ok) return indexResult;
        const closeResult = expect("symbol", "]", "Expected ']' after index");
        if (!closeResult.ok) return closeResult;
        expr = {
          kind: "IndexExpr",
          target: expr,
          index: indexResult.value,
          loc: expr.loc,
          start: expr.start,
          end: closeResult.value.end,
        };
        continue;
      }
      if (at("symbol", "?")) {
        const tok = eat();
        expr = {
          kind: "UnwrapExpr",
          expr,
          loc: expr.loc,
          start: expr.start,
          end: tok.end,
        };
        continue;
      }
      break;
    }
    return ok(expr);
  };

  const parsePrimary = (): ParseResult<Expr> => {
    const tryParseLambdaExpr = (): ParseResult<Expr | undefined> => {
      if (!at("symbol", "(")) return ok(undefined);
      const snapshot = i;
      eat();
      const params: { name: string; type: Expr | undefined }[] = [];
      if (!at("symbol", ")")) {
        while (true) {
          if (!at("identifier")) {
            i = snapshot;
            return ok(undefined);
          }
          const paramNameTok = eat();
          let paramType = undefined;
          if (at("symbol", ":")) {
            eat();
            const pTypeResult = parseType();
            if (!pTypeResult.ok) {
              i = snapshot;
              return ok(undefined);
            }
            paramType = pTypeResult.value;
          }
          params.push({ name: paramNameTok.value as string, type: paramType });
          if (at("symbol", ",")) {
            eat();
            continue;
          }
          break;
        }
      }
      const closeResult = expect("symbol", ")", "Expected ')' after params");
      if (!closeResult.ok) {
        i = snapshot;
        return ok(undefined);
      }
      if (!at("symbol", "=>")) {
        i = snapshot;
        return ok(undefined);
      }
      eat();
      const bodyResult = at("symbol", "{") ? parseBlock() : parseExpression();
      if (!bodyResult.ok) return bodyResult;
      return ok({
        kind: "LambdaExpr",
        params,
        body: bodyResult.value,
        loc: closeResult.value.loc,
      });
    };

    const tryParseFnExpr = (): ParseResult<Expr | undefined> => {
      if (!at("keyword", "fn")) return ok(undefined);
      eat();

      let name = undefined;
      if (at("identifier")) {
        const nameResult = parseIdentifier();
        if (!nameResult.ok) return nameResult;
        name = nameResult.value;
      }

      const genericConstraints: Record<string, Expr> = {};
      const genericsResult = parseGenericParams(
        "Expected '>' after generics",
        genericConstraints,
      );
      if (!genericsResult.ok) return genericsResult;
      const paramsResult = parseTypedParams(
        "Expected '(' in function expression",
        "Expected ')' after params",
      );
      if (!paramsResult.ok) return paramsResult;
      const returnTypeResult = parseOptionalReturnType();
      if (!returnTypeResult.ok) return returnTypeResult;
      const arrowResult = expect(
        "symbol",
        "=>",
        "Expected '=>' in function expression",
      );
      if (!arrowResult.ok) return arrowResult;
      const bodyResult = at("symbol", "{") ? parseBlock() : parseExpression();
      if (!bodyResult.ok) return bodyResult;

      return ok({
        kind: "FnExpr",
        name,
        generics: genericsResult.value,
        genericConstraints,
        params: paramsResult.value,
        returnType: returnTypeResult.value,
        body: bodyResult.value,
        loc: arrowResult.value.loc,
      });
    };

    const parseNumberLiteralToken = (t: Token): Expr => {
      const raw = String(t.value ?? "");
      const match = raw.match(/^(-?\d+(?:\.\d+)?)([A-Za-z][A-Za-z0-9]*)?$/);
      const numericPart = match?.[1] ?? raw;
      const suffix = match?.[2] ?? undefined;
      return {
        kind: "NumberLiteral",
        value: Number(numericPart),
        numberType: suffix ?? "I32",
        raw,
        loc: t.loc,
        start: t.start,
        end: t.end,
      };
    };

    if (at("number")) {
      const t = eat();
      return parsePostfix(parseNumberLiteralToken(t));
    }
    if (at("bool")) {
      const t = eat();
      return parsePostfix({
        kind: "BoolLiteral",
        value: !!t.value,
        loc: t.loc,
        start: t.start,
        end: t.end,
      });
    }
    if (at("string")) {
      const t = eat();
      return parsePostfix({
        kind: "StringLiteral",
        value: t.value,
        loc: t.loc,
        start: t.start,
        end: t.end,
      });
    }
    if (at("char")) {
      const t = eat();
      return parsePostfix({
        kind: "CharLiteral",
        value: t.value,
        loc: t.loc,
        start: t.start,
        end: t.end,
      });
    }

    const lambdaAttempt = tryParseLambdaExpr();
    if (!lambdaAttempt.ok) return lambdaAttempt;
    if (lambdaAttempt.value) {
      return parsePostfix(lambdaAttempt.value);
    }

    const fnExprAttempt = tryParseFnExpr();
    if (!fnExprAttempt.ok) return fnExprAttempt;
    if (fnExprAttempt.value) {
      return parsePostfix(fnExprAttempt.value);
    }

    if (at("symbol", "(")) {
      eat();
      const exprResult = parseExpression();
      if (!exprResult.ok) return exprResult;
      const close = expect("symbol", ")", "Expected ')' after expression");
      if (!close.ok) return close;
      return parsePostfix(exprResult.value);
    }

    if (at("keyword", "if")) {
      const start = eat().loc;
      const openResult = expect("symbol", "(", "Expected '(' after if");
      if (!openResult.ok) return openResult;
      const condResult = parseExpression();
      if (!condResult.ok) return condResult;
      const closeResult = expect(
        "symbol",
        ")",
        "Expected ')' after if condition",
      );
      if (!closeResult.ok) return closeResult;
      const thenResult = at("symbol", "{") ? parseBlock() : parseExpression();
      if (!thenResult.ok) return thenResult;
      let elseBranch = undefined;
      if (at("keyword", "else")) {
        eat();
        const elseResult = at("symbol", "{") ? parseBlock() : parseExpression();
        if (!elseResult.ok) return elseResult;
        elseBranch = elseResult.value;
      }
      return parsePostfix({
        kind: "IfExpr",
        condition: condResult.value,
        thenBranch: thenResult.value,
        elseBranch,
        loc: start,
      });
    }

    if (at("keyword", "match")) {
      const start = eat().loc;
      const openResult = expect("symbol", "(", "Expected '(' after match");
      if (!openResult.ok) return openResult;
      const targetResult = parseExpression();
      if (!targetResult.ok) return targetResult;
      const closeResult = expect(
        "symbol",
        ")",
        "Expected ')' after match target",
      );
      if (!closeResult.ok) return closeResult;
      const braceResult = expect("symbol", "{", "Expected '{' for match");
      if (!braceResult.ok) return braceResult;
      const cases: { pattern: Expr; body: Expr }[] = [];
      while (!at("symbol", "}")) {
        const caseResult = expect("keyword", "case", "Expected case in match");
        if (!caseResult.ok) return caseResult;
        const patternResult = parsePattern();
        if (!patternResult.ok) return patternResult;
        const eqResult = expect(
          "symbol",
          "=",
          "Expected '=' after case pattern",
        );
        if (!eqResult.ok) return eqResult;
        const bodyResult = at("symbol", "{") ? parseBlock() : parseExpression();
        if (!bodyResult.ok) return bodyResult;
        const semiResult = expect(
          "symbol",
          ";",
          "Expected ';' after case body",
        );
        if (!semiResult.ok) return semiResult;
        cases.push({ pattern: patternResult.value, body: bodyResult.value });
      }
      const endBraceResult = expect("symbol", "}", "Expected '}' for match");
      if (!endBraceResult.ok) return endBraceResult;
      return parsePostfix({
        kind: "MatchExpr",
        target: targetResult.value,
        cases,
        loc: start,
      });
    }

    if (at("identifier")) {
      const canStartTypeToken = (tok: Token | undefined): boolean => {
        if (!tok) return false;
        if (tok.type === "identifier") return true;
        if (
          tok.type === "symbol" &&
          ["*", "[", "("].includes(tok.value as string)
        )
          return true;
        return false;
      };

      const hasGenericStructInitSuffix = (): boolean => {
        if (!at("symbol", "<") || !canStartTypeToken(peek(1))) {
          return false;
        }
        let j = i;
        let depth = 0;
        while (j < tokens.length) {
          const t = tokens[j];
          if (
            depth > 0 &&
            t.type === "symbol" &&
            [
              ")",
              ";",
              "{",
              "}",
              "=",
              "==",
              "!=",
              "<=",
              ">=",
              "&&",
              "||",
              "+",
              "-",
              "*",
              "/",
              "%",
              "..",
              "=>",
              ".",
            ].includes(t.value as string)
          ) {
            return false;
          }
          if (t.type === "symbol" && t.value === "<") {
            depth += 1;
            j += 1;
            continue;
          }
          if (t.type === "symbol" && t.value === ">") {
            depth -= 1;
            j += 1;
            if (depth === 0) {
              const next = tokens[j];
              return next?.type === "symbol" && next?.value === "{";
            }
            continue;
          }
          if (t.type === "eof") return false;
          j += 1;
        }
        return false;
      };

      const hasGenericValueSuffix = (): boolean => {
        if (!at("symbol", "<") || !canStartTypeToken(peek(1))) {
          return false;
        }
        let j = i;
        let depth = 0;
        while (j < tokens.length) {
          const t = tokens[j];
          if (
            depth > 0 &&
            t.type === "symbol" &&
            [
              ")",
              ";",
              "{",
              "}",
              "=",
              "==",
              "!=",
              "<=",
              ">=",
              "&&",
              "||",
              "+",
              "-",
              "*",
              "/",
              "%",
              "..",
              "=>",
              ".",
            ].includes(t.value as string)
          ) {
            return false;
          }
          if (t.type === "symbol" && t.value === "<") {
            depth += 1;
            j += 1;
            continue;
          }
          if (t.type === "symbol" && t.value === ">") {
            depth -= 1;
            j += 1;
            if (depth === 0) {
              const next = tokens[j];
              if (!next) return false;
              if (next.type === "symbol" && next.value === "(") return false;
              return true;
            }
            continue;
          }
          if (t.type === "eof") return false;
          j += 1;
        }
        return false;
      };

      const idTok = eat();
      const genericArgs: Expr[] = [];
      const typeLikeName = /^[A-Z]/.test(String(idTok.value ?? ""));
      if (
        typeLikeName &&
        (hasGenericStructInitSuffix() || hasGenericValueSuffix())
      ) {
        eat(); // '<'
        if (!at("symbol", ">")) {
          while (true) {
            const argResult = parseType();
            if (!argResult.ok) return argResult;
            genericArgs.push(argResult.value);
            if (!at("symbol", ",")) break;
            eat();
          }
        }
        const closeGenericResult = expect(
          "symbol",
          ">",
          "Expected '>' in generic struct initializer",
        );
        if (!closeGenericResult.ok) return closeGenericResult;
      }

      let expr: Expr = {
        kind: "Identifier",
        name: idTok.value,
        genericArgs,
        loc: idTok.loc,
        start: idTok.start,
        end: idTok.end,
      };

      if (at("symbol", "{")) {
        eat();
        const fields: { key: string; value: Expr }[] = [];
        if (!at("symbol", "}")) {
          while (true) {
            const keyResult = parseIdentifier();
            if (!keyResult.ok) return keyResult;
            const colonResult = expect(
              "symbol",
              ":",
              "Expected ':' in struct init",
            );
            if (!colonResult.ok) return colonResult;
            const valueResult = parseExpression();
            if (!valueResult.ok) return valueResult;
            fields.push({ key: keyResult.value, value: valueResult.value });
            if (!at("symbol", ",")) break;
            eat();
          }
        }
        const closeResult = expect(
          "symbol",
          "}",
          "Expected '}' in struct init",
        );
        if (!closeResult.ok) return closeResult;
        expr = {
          kind: "StructInit",
          name: idTok.value,
          genericArgs,
          fields,
          loc: idTok.loc,
        };
      }

      return parsePostfix(expr);
    }

    return err(
      new TuffError(
        `Unexpected token ${peek().type}:${peek().value}`,
        peek().loc,
        {
          code: "E_PARSE_UNEXPECTED_TOKEN",
          hint: "Ensure expressions and statements use valid Tuff-lite syntax.",
        },
      ),
    );
  };

  const parseUnary = (): ParseResult<Expr> => {
    if (at("symbol", "!") || at("symbol", "-") || at("symbol", "&")) {
      const tok = eat();
      const op =
        tok.value === "&" && at("keyword", "mut")
          ? `${tok.value}${eat().value}`
          : tok.value;
      const innerResult = parseUnary();
      if (!innerResult.ok) return innerResult;
      const inner = innerResult.value;
      return ok({
        kind: "UnaryExpr",
        op,
        expr: inner,
        loc: tok.loc,
        start: tok.start,
        end: inner?.end ?? tok.end,
      });
    }
    return parsePrimary();
  };

  const parseExpression = (minPrec = 0): ParseResult<Expr> => {
    const leftResult = parseUnary();
    if (!leftResult.ok) return leftResult;
    let left = leftResult.value;
    while (true) {
      if (minPrec <= 0 && at("keyword", "into")) {
        const intoTok = eat();
        const contractNameResult = parseIdentifier();
        if (!contractNameResult.ok) return contractNameResult;
        const args: Expr[] = [];
        if (at("symbol", "(")) {
          eat();
          if (!at("symbol", ")")) {
            while (true) {
              const argResult = parseExpression();
              if (!argResult.ok) return argResult;
              args.push(argResult.value);
              if (!at("symbol", ",")) break;
              eat();
            }
          }
          const closeResult = expect(
            "symbol",
            ")",
            "Expected ')' after into arguments",
          );
          if (!closeResult.ok) return closeResult;
        }
        left = {
          kind: "IntoExpr",
          value: left,
          contractName: contractNameResult.value,
          args,
          loc: left.loc ?? intoTok.loc,
          start: left?.start,
          end: left?.end,
        };
        continue;
      }

      const t = peek();
      const op =
        t.type === "keyword" ? (t.value as string) : (t.value as string);
      const prec = precedence[op];
      if (prec === undefined || prec < minPrec) break;
      eat();
      if (op === "is") {
        const patternResult = parsePattern();
        if (!patternResult.ok) return patternResult;
        left = {
          kind: "IsExpr",
          expr: left,
          pattern: patternResult.value,
          loc: left.loc ?? t.loc,
          start: left?.start,
          end: left?.end,
        };
      } else {
        const rightResult = parseExpression(prec + 1);
        if (!rightResult.ok) return rightResult;
        const right = rightResult.value;
        left = {
          kind: "BinaryExpr",
          op,
          left,
          right,
          loc: left.loc ?? t.loc,
          start: left?.start,
          end: right?.end ?? left?.end,
        };
      }
    }
    return ok(left);
  };

  const parseLetDecl = (): ParseResult<Stmt> => {
    const startResult = expect("keyword", "let");
    if (!startResult.ok) return startResult;
    const start = startResult.value.loc;
    const mutable = at("keyword", "mut") ? !!eat() : false;
    if (at("symbol", "{")) {
      eat();
      const names: string[] = [];
      if (!at("symbol", "}")) {
        while (true) {
          const nameResult = parseIdentifier();
          if (!nameResult.ok) return nameResult;
          names.push(nameResult.value);
          if (!at("symbol", ",")) break;
          eat();
        }
      }
      const closeResult = expect(
        "symbol",
        "}",
        "Expected '}' in destructuring import",
      );
      if (!closeResult.ok) return closeResult;
      const eqResult = expect(
        "symbol",
        "=",
        "Expected '=' in import-style let",
      );
      if (!eqResult.ok) return eqResult;
      const firstPartResult = parseIdentifier();
      if (!firstPartResult.ok) return firstPartResult;
      const moduleParts = [firstPartResult.value];
      while (at("symbol", "::")) {
        eat();
        const partResult = parseIdentifier();
        if (!partResult.ok) return partResult;
        moduleParts.push(partResult.value);
      }
      const semiResult = expect(
        "symbol",
        ";",
        "Expected ';' after import-style let",
      );
      if (!semiResult.ok) return semiResult;
      return ok({
        kind: "ImportDecl",
        names,
        modulePath: moduleParts.join("::"),
        loc: start,
      });
    }

    const nameResult = parseIdentifier();
    if (!nameResult.ok) return nameResult;
    let type = undefined;
    if (at("symbol", ":")) {
      eat();
      const typeResult = parseType();
      if (!typeResult.ok) return typeResult;
      type = typeResult.value;
    }
    if (at("symbol", ";")) {
      if (!type) {
        return err(
          new TuffError(
            "Uninitialized let declaration requires an explicit type",
            start,
            {
              code: "E_PARSE_EXPECTED_TOKEN",
              hint: "Write 'let mut name : Type;' for uninitialized declarations.",
            },
          ),
        );
      }
      eat();
      return ok({
        kind: "LetDecl",
        name: nameResult.value,
        type,
        value: undefined,
        mutable,
        loc: start,
      });
    }

    const eqResult = expect("symbol", "=", "Expected '=' in let declaration");
    if (!eqResult.ok) return eqResult;
    const valueResult = parseExpression();
    if (!valueResult.ok) return valueResult;
    const semiResult = expect(
      "symbol",
      ";",
      "Expected ';' after let declaration",
    );
    if (!semiResult.ok) return semiResult;
    return ok({
      kind: "LetDecl",
      name: nameResult.value,
      type,
      value: valueResult.value,
      mutable,
      loc: start,
    });
  };

  const parseFunction = (
    isClassSugar = false,
    mode: "normal" | "expect" | "actual" = "normal",
  ): ParseResult<Stmt> => {
    const fnResult = expect("keyword", "fn", "Expected fn");
    if (!fnResult.ok) return fnResult;
    const nameResult = parseIdentifier();
    if (!nameResult.ok) return nameResult;
    const genericConstraints: Record<string, Expr> = {};
    const genericsResult = parseGenericParams(
      "Expected '>' after generics",
      genericConstraints,
    );
    if (!genericsResult.ok) return genericsResult;
    const generics = genericsResult.value;

    const signatureResult = parseFunctionSignature(
      "Expected '(' in function declaration",
      "Expected ')' after params",
    );
    if (!signatureResult.ok) return signatureResult;
    const { params, returnType } = signatureResult.value;

    let body = undefined;
    if (mode === "expect") {
      const semiResult = expect(
        "symbol",
        ";",
        "Expected ';' after expect function declaration",
      );
      if (!semiResult.ok) return semiResult;
    } else {
      let bodyResult;
      if (at("symbol", "{")) {
        bodyResult = parseBlock();
      } else {
        const arrowResult = expect(
          "symbol",
          "=>",
          "Expected '=>' in function declaration",
        );
        if (!arrowResult.ok) return arrowResult;
        bodyResult = at("symbol", "{") ? parseBlock() : parseExpression();
      }
      if (!bodyResult.ok) return bodyResult;
      body = bodyResult.value;
      if (
        !at("symbol", "}") &&
        !at("eof") &&
        bodyResult.value.kind !== "Block"
      ) {
        const semiResult = expect(
          "symbol",
          ";",
          "Expected ';' after expression function",
        );
        if (!semiResult.ok) return semiResult;
      }
    }

    return ok({
      kind: isClassSugar ? "ClassFunctionDecl" : "FnDecl",
      name: nameResult.value,
      generics,
      genericConstraints,
      params,
      returnType,
      body,
      expectDecl: mode === "expect",
      actualDecl: mode === "actual",
    });
  };

  function parseFunctionSignature(
    openMessage: string,
    closeMessage: string,
  ): ParseResult<{
    params: { name: string; type: Expr }[];
    returnType: Expr;
  }> {
    const paramsResult = parseTypedParams(openMessage, closeMessage);
    if (!paramsResult.ok) return paramsResult;
    const returnTypeResult = parseOptionalReturnType();
    if (!returnTypeResult.ok) return returnTypeResult;
    return ok({
      params: paramsResult.value,
      returnType: returnTypeResult.value,
    });
  }

  const parseStruct = (isCopy = false): ParseResult<Stmt> => {
    const structResult = expect("keyword", "struct");
    if (!structResult.ok) return structResult;
    const nameResult = parseIdentifier();
    if (!nameResult.ok) return nameResult;
    const genericsResult = parseGenericParams("Expected '>'");
    if (!genericsResult.ok) return genericsResult;
    const generics = genericsResult.value;
    const openResult = expect("symbol", "{");
    if (!openResult.ok) return openResult;
    const fields: { name: string; type: Expr }[] = [];
    while (!at("symbol", "}")) {
      const fieldNameResult = parseIdentifier();
      if (!fieldNameResult.ok) return fieldNameResult;
      const colonResult = expect("symbol", ":", "Expected ':' in struct field");
      if (!colonResult.ok) return colonResult;
      const fieldTypeResult = parseType();
      if (!fieldTypeResult.ok) return fieldTypeResult;
      fields.push({ name: fieldNameResult.value, type: fieldTypeResult.value });
      if (at("symbol", ",") || at("symbol", ";")) eat();
    }
    const closeResult = expect("symbol", "}");
    if (!closeResult.ok) return closeResult;
    return ok({
      kind: "StructDecl",
      name: nameResult.value,
      generics,
      fields,
      isCopy,
    });
  };

  const parseEnum = (): ParseResult<Stmt> => {
    const enumResult = expect("keyword", "enum");
    if (!enumResult.ok) return enumResult;
    const nameResult = parseIdentifier();
    if (!nameResult.ok) return nameResult;
    const openResult = expect("symbol", "{", "Expected '{' after enum name");
    if (!openResult.ok) return openResult;
    const variants: string[] = [];
    while (!at("symbol", "}")) {
      const variantResult = parseIdentifier();
      if (!variantResult.ok) return variantResult;
      variants.push(variantResult.value);
      if (at("symbol", ",") || at("symbol", ";")) eat();
    }
    const closeResult = expect("symbol", "}", "Expected '}' after enum body");
    if (!closeResult.ok) return closeResult;
    return ok({ kind: "EnumDecl", name: nameResult.value, variants });
  };

  const parseObject = (): ParseResult<Stmt> => {
    const objectResult = expect("keyword", "object", "Expected object");
    if (!objectResult.ok) return objectResult;
    const nameResult = parseIdentifier();
    if (!nameResult.ok) return nameResult;
    const genericsResult = parseGenericParams(
      "Expected '>' after object generics",
    );
    if (!genericsResult.ok) return genericsResult;
    const generics = genericsResult.value;
    const openResult = expect("symbol", "{", "Expected '{' after object");
    if (!openResult.ok) return openResult;
    const inputs: { name: string; type: Expr }[] = [];
    while (!at("symbol", "}")) {
      const inResult = expect(
        "keyword",
        "in",
        "Expected 'in' in object input declaration",
      );
      if (!inResult.ok) return inResult;
      const letResult = expect(
        "keyword",
        "let",
        "Expected 'let' in object input declaration",
      );
      if (!letResult.ok) return letResult;
      const inputNameResult = parseIdentifier();
      if (!inputNameResult.ok) return inputNameResult;
      const colonResult = expect(
        "symbol",
        ":",
        "Expected ':' in object input declaration",
      );
      if (!colonResult.ok) return colonResult;
      const inputTypeResult = parseType();
      if (!inputTypeResult.ok) return inputTypeResult;
      const semiResult = expect(
        "symbol",
        ";",
        "Expected ';' after object input declaration",
      );
      if (!semiResult.ok) return semiResult;
      inputs.push({ name: inputNameResult.value, type: inputTypeResult.value });
    }
    const closeResult = expect("symbol", "}", "Expected '}' after object");
    if (!closeResult.ok) return closeResult;
    return ok({
      kind: "ObjectDecl",
      name: nameResult.value,
      generics,
      inputs,
    });
  };

  const parseContract = (): ParseResult<Stmt> => {
    const contractResult = expect("keyword", "contract", "Expected contract");
    if (!contractResult.ok) return contractResult;
    const nameResult = parseIdentifier();
    if (!nameResult.ok) return nameResult;
    const openResult = expect("symbol", "{", "Expected '{' after contract");
    if (!openResult.ok) return openResult;

    const methods: {
      name: string;
      generics: string[];
      params: {
        name: string;
        type: Expr | undefined;
        implicitThis?: boolean;
      }[];
      returnType: Expr | undefined;
    }[] = [];

    while (!at("symbol", "}")) {
      const fnResult = expect(
        "keyword",
        "fn",
        "Expected 'fn' in contract declaration",
      );
      if (!fnResult.ok) return fnResult;

      const methodNameResult = parseIdentifier();
      if (!methodNameResult.ok) return methodNameResult;

      const genericsResult = parseGenericParams(
        "Expected '>' after contract method generics",
      );
      if (!genericsResult.ok) return genericsResult;

      const openParamsResult = expect(
        "symbol",
        "(",
        "Expected '(' in contract method signature",
      );
      if (!openParamsResult.ok) return openParamsResult;

      const params: {
        name: string;
        type: Expr | undefined;
        implicitThis?: boolean;
      }[] = [];
      if (!at("symbol", ")")) {
        while (true) {
          if (at("symbol", "*")) {
            eat();
            const mutable = at("keyword", "mut") ? !!eat() : false;
            const thisNameResult = parseIdentifier();
            if (!thisNameResult.ok) return thisNameResult;
            params.push({
              name: thisNameResult.value,
              implicitThis: true,
              type: {
                kind: "PointerType",
                mutable,
                to: { kind: "NamedType", name: "This", genericArgs: [] },
              },
            });
          } else {
            const paramNameResult = parseIdentifier();
            if (!paramNameResult.ok) return paramNameResult;
            let paramType = undefined;
            if (at("symbol", ":")) {
              eat();
              const paramTypeResult = parseType();
              if (!paramTypeResult.ok) return paramTypeResult;
              paramType = paramTypeResult.value;
            }
            params.push({ name: paramNameResult.value, type: paramType });
          }

          if (!at("symbol", ",")) break;
          eat();
        }
      }

      const closeParamsResult = expect(
        "symbol",
        ")",
        "Expected ')' after contract method params",
      );
      if (!closeParamsResult.ok) return closeParamsResult;

      const returnTypeResult = parseOptionalReturnType();
      if (!returnTypeResult.ok) return returnTypeResult;

      const semiResult = expect(
        "symbol",
        ";",
        "Expected ';' after contract method signature",
      );
      if (!semiResult.ok) return semiResult;

      methods.push({
        name: methodNameResult.value,
        generics: genericsResult.value,
        params,
        returnType: returnTypeResult.value,
      });
    }

    const closeResult = expect(
      "symbol",
      "}",
      "Expected '}' after contract body",
    );
    if (!closeResult.ok) return closeResult;

    return ok({ kind: "ContractDecl", name: nameResult.value, methods });
  };

  const parseTypeAlias = (isCopy = false): ParseResult<Stmt> => {
    const typeResult = expect("keyword", "type");
    if (!typeResult.ok) return typeResult;
    const nameResult = parseIdentifier();
    if (!nameResult.ok) return nameResult;
    const genericsResult = parseGenericParams(
      "Expected '>' after alias generics",
    );
    if (!genericsResult.ok) return genericsResult;
    const generics = genericsResult.value;
    const eqResult = expect("symbol", "=", "Expected '=' for type alias");
    if (!eqResult.ok) return eqResult;
    const aliasedTypeResult = parseType();
    if (!aliasedTypeResult.ok) return aliasedTypeResult;
    let destructorName = undefined;
    if (at("keyword", "then")) {
      eat();
      const dtorNameResult = parseIdentifier();
      if (!dtorNameResult.ok) return dtorNameResult;
      destructorName = dtorNameResult.value;
    }
    const semiResult = expect("symbol", ";", "Expected ';' after type alias");
    if (!semiResult.ok) return semiResult;
    return ok({
      kind: "TypeAlias",
      name: nameResult.value,
      generics,
      aliasedType: aliasedTypeResult.value,
      destructorName,
      isCopy,
    });
  };

  const parseForStmt = (): ParseResult<Stmt> => {
    const forResult = expect("keyword", "for");
    if (!forResult.ok) return forResult;
    const openResult = expect("symbol", "(");
    if (!openResult.ok) return openResult;
    const iteratorResult = parseIdentifier();
    if (!iteratorResult.ok) return iteratorResult;
    const inResult = expect("keyword", "in", "Expected 'in' in for loop");
    if (!inResult.ok) return inResult;
    const startResult = parseExpression();
    if (!startResult.ok) return startResult;
    const dotdotResult = expect("symbol", "..", "Expected '..' in for range");
    if (!dotdotResult.ok) return dotdotResult;
    const endResult = parseExpression();
    if (!endResult.ok) return endResult;
    const closeResult = expect("symbol", ")", "Expected ')' after for header");
    if (!closeResult.ok) return closeResult;
    const bodyResult = parseBlock();
    if (!bodyResult.ok) return bodyResult;
    return ok({
      kind: "ForStmt",
      iterator: iteratorResult.value,
      start: startResult.value,
      end: endResult.value,
      body: bodyResult.value,
    });
  };

  const parseLoopStmt = (): ParseResult<Stmt> => {
    const loopResult = expect("keyword", "loop");
    if (!loopResult.ok) return loopResult;
    const bodyResult = parseBlock();
    if (!bodyResult.ok) return bodyResult;
    return ok({
      kind: "LoopStmt",
      body: bodyResult.value,
    });
  };

  const parseLifetimeStmt = (): ParseResult<Stmt> => {
    const startResult = expect("keyword", "lifetime", "Expected lifetime");
    if (!startResult.ok) return startResult;
    const nameResult = parseIdentifier();
    if (!nameResult.ok) return nameResult;
    const bodyResult = parseBlock();
    if (!bodyResult.ok) return bodyResult;
    return ok({
      kind: "LifetimeStmt",
      name: nameResult.value,
      body: bodyResult.value,
      loc: startResult.value.loc,
    });
  };

  const parseStatement = (): ParseResult<Stmt> => {
    const atContextualModifier = (name: "expect" | "actual") => {
      const t = peek();
      return (
        (t.type === "keyword" || t.type === "identifier") && t.value === name
      );
    };

    let exported = false;
    let copyDecl = false;
    let expectDecl = false;
    let actualDecl = false;
    let modifierLoc = undefined;
    let consumedModifier = false;
    while (
      at("keyword", "out") ||
      at("keyword", "copy") ||
      atContextualModifier("expect") ||
      atContextualModifier("actual")
    ) {
      consumedModifier = true;
      const tok = eat();
      modifierLoc = modifierLoc ?? tok.loc;
      if (tok.value === "out") {
        if (exported) {
          return err(
            new TuffError("Duplicate 'out' modifier", tok.loc, {
              code: "E_PARSE_EXPECTED_TOKEN",
              hint: "Use 'out' at most once before a declaration.",
            }),
          );
        }
        exported = true;
      } else {
        if (tok.value === "copy") {
          if (copyDecl) {
            return err(
              new TuffError("Duplicate 'copy' modifier", tok.loc, {
                code: "E_PARSE_EXPECTED_TOKEN",
                hint: "Use 'copy' at most once before a declaration.",
              }),
            );
          }
          copyDecl = true;
        } else if (tok.value === "expect") {
          if (expectDecl) {
            return err(
              new TuffError("Duplicate 'expect' modifier", tok.loc, {
                code: "E_PARSE_EXPECTED_TOKEN",
                hint: "Use 'expect' at most once before a declaration.",
              }),
            );
          }
          expectDecl = true;
        } else if (tok.value === "actual") {
          if (actualDecl) {
            return err(
              new TuffError("Duplicate 'actual' modifier", tok.loc, {
                code: "E_PARSE_EXPECTED_TOKEN",
                hint: "Use 'actual' at most once before a declaration.",
              }),
            );
          }
          actualDecl = true;
        } else if (copyDecl) {
          return err(
            new TuffError("Duplicate 'copy' modifier", tok.loc, {
              code: "E_PARSE_EXPECTED_TOKEN",
              hint: "Use 'copy' at most once before a declaration.",
            }),
          );
        } else {
          copyDecl = true;
        }
      }
    }

    if (expectDecl && actualDecl) {
      return err(
        new TuffError(
          "Cannot combine 'expect' and 'actual' modifiers",
          peek().loc,
          {
            code: "E_PARSE_EXPECTED_TOKEN",
            hint: "Use either 'expect fn ...;' or 'actual fn ... => ...'.",
          },
        ),
      );
    }

    if (consumedModifier) {
      let nodeResult: ParseResult<Stmt> | undefined = undefined;
      if (at("keyword", "fn")) {
        if (copyDecl) {
          return err(
            new TuffError(
              "'copy' is only supported on struct/type declarations",
              peek().loc,
              {
                code: "E_PARSE_EXPECTED_TOKEN",
                hint: "Use 'copy struct ...' or 'copy type ...'.",
              },
            ),
          );
        }
        nodeResult = parseFunction(
          false,
          expectDecl ? "expect" : actualDecl ? "actual" : "normal",
        );
      } else if (at("keyword", "struct")) {
        if (expectDecl || actualDecl) {
          return err(
            new TuffError(
              "'expect'/'actual' are currently supported only on fn declarations",
              peek().loc,
              {
                code: "E_PARSE_EXPECTED_TOKEN",
                hint: "Use expect/actual before fn declarations.",
              },
            ),
          );
        }
        nodeResult = parseStruct(copyDecl);
      } else if (at("keyword", "enum")) {
        if (expectDecl || actualDecl) {
          return err(
            new TuffError(
              "'expect'/'actual' are currently supported only on fn declarations",
              peek().loc,
              {
                code: "E_PARSE_EXPECTED_TOKEN",
                hint: "Use expect/actual before fn declarations.",
              },
            ),
          );
        }
        nodeResult = parseEnum();
      } else if (at("keyword", "object")) {
        if (copyDecl) {
          return err(
            new TuffError(
              "'copy' is only supported on struct/type declarations",
              peek().loc,
              {
                code: "E_PARSE_EXPECTED_TOKEN",
                hint: "Use 'copy struct ...' or 'copy type ...'.",
              },
            ),
          );
        }
        if (expectDecl || actualDecl) {
          return err(
            new TuffError(
              "'expect'/'actual' are currently supported only on fn declarations",
              peek().loc,
              {
                code: "E_PARSE_EXPECTED_TOKEN",
                hint: "Use expect/actual before fn declarations.",
              },
            ),
          );
        }
        nodeResult = parseObject();
      } else if (at("keyword", "contract")) {
        if (copyDecl) {
          return err(
            new TuffError(
              "'copy' is only supported on struct/type declarations",
              peek().loc,
              {
                code: "E_PARSE_EXPECTED_TOKEN",
                hint: "Use 'copy struct ...' or 'copy type ...'.",
              },
            ),
          );
        }
        if (expectDecl || actualDecl) {
          return err(
            new TuffError(
              "'expect'/'actual' are currently supported only on fn declarations",
              peek().loc,
              {
                code: "E_PARSE_EXPECTED_TOKEN",
                hint: "Use expect/actual before fn declarations.",
              },
            ),
          );
        }
        nodeResult = parseContract();
      } else if (at("keyword", "type")) {
        if (expectDecl || actualDecl) {
          return err(
            new TuffError(
              "'expect'/'actual' are currently supported only on fn declarations",
              peek().loc,
              {
                code: "E_PARSE_EXPECTED_TOKEN",
                hint: "Use expect/actual before fn declarations.",
              },
            ),
          );
        }
        nodeResult = parseTypeAlias(copyDecl);
      } else if (at("keyword", "class")) {
        if (copyDecl) {
          return err(
            new TuffError(
              "'copy' is only supported on struct/type declarations",
              peek().loc,
              {
                code: "E_PARSE_EXPECTED_TOKEN",
                hint: "Use 'copy struct ...' or 'copy type ...'.",
              },
            ),
          );
        }
        if (expectDecl || actualDecl) {
          return err(
            new TuffError(
              "'expect'/'actual' are currently supported only on fn declarations",
              peek().loc,
              {
                code: "E_PARSE_EXPECTED_TOKEN",
                hint: "Use expect/actual before fn declarations.",
              },
            ),
          );
        }
        eat();
        nodeResult = parseFunction(true);
      } else {
        return err(
          new TuffError("Expected declaration after modifiers", peek().loc, {
            code: "E_PARSE_EXPECTED_TOKEN",
            hint: "Use modifiers before a top-level fn/struct/enum/type/class declaration.",
          }),
        );
      }

      if (!nodeResult.ok) return nodeResult;
      const node = nodeResult.value;
      if (exported) node.exported = true;
      node.loc = node.loc ?? modifierLoc;
      return ok(node);
    }

    if (at("keyword", "let")) return parseLetDecl();
    if (at("keyword", "struct")) return parseStruct(false);
    if (at("keyword", "enum")) return parseEnum();
    if (at("keyword", "object")) return parseObject();
    if (at("keyword", "contract")) return parseContract();
    if (at("keyword", "type")) return parseTypeAlias(false);
    if (at("keyword", "fn")) return parseFunction(false);
    if (at("keyword", "extern")) {
      eat();
      if (at("keyword", "fn")) {
        const fnKeywordResult = expect("keyword", "fn", "Expected fn");
        if (!fnKeywordResult.ok) return fnKeywordResult;
        const nameResult = parseIdentifier();
        if (!nameResult.ok) return nameResult;
        const genericsResult = parseGenericParams(
          "Expected '>' after generics",
        );
        if (!genericsResult.ok) return genericsResult;
        const generics = genericsResult.value;
        const signatureResult = parseFunctionSignature(
          "Expected '('",
          "Expected ')'",
        );
        if (!signatureResult.ok) return signatureResult;
        const { params, returnType } = signatureResult.value;
        const semiResult = expect(
          "symbol",
          ";",
          "Expected ';' after extern fn",
        );
        if (!semiResult.ok) return semiResult;
        return ok({
          kind: "ExternFnDecl",
          name: nameResult.value,
          generics,
          params,
          returnType,
          body: undefined,
        });
      }
      if (at("keyword", "let")) {
        const startResult = expect("keyword", "let");
        if (!startResult.ok) return startResult;
        const start = startResult.value.loc;
        const nameResult = parseIdentifier();
        if (!nameResult.ok) return nameResult;
        const colonResult = expect("symbol", ":", "Expected ':' in extern let");
        if (!colonResult.ok) return colonResult;
        const typeResult = parseType();
        if (!typeResult.ok) return typeResult;
        const semiResult = expect(
          "symbol",
          ";",
          "Expected ';' after extern let",
        );
        if (!semiResult.ok) return semiResult;
        return ok({
          kind: "ExternLetDecl",
          name: nameResult.value,
          type: typeResult.value,
          loc: start,
        });
      }
      if (at("keyword", "type")) {
        eat();
        const nameResult = parseIdentifier();
        if (!nameResult.ok) return nameResult;
        const genericsResult = parseGenericParams(
          "Expected '>' after extern type generics",
        );
        if (!genericsResult.ok) return genericsResult;
        const generics = genericsResult.value;
        const semiResult = expect(
          "symbol",
          ";",
          "Expected ';' after extern type",
        );
        if (!semiResult.ok) return semiResult;
        return ok({ kind: "ExternTypeDecl", name: nameResult.value, generics });
      }
      return err(
        new TuffError(
          "Expected 'fn', 'let', or 'type' after 'extern'",
          peek().loc,
        ),
      );
    }
    if (at("keyword", "class")) {
      eat();
      return parseFunction(true);
    }
    if (at("keyword", "return")) {
      eat();
      let value = undefined;
      if (!at("symbol", ";")) {
        const valueResult = parseExpression();
        if (!valueResult.ok) return valueResult;
        value = valueResult.value;
      }
      const semiResult = expect("symbol", ";", "Expected ';' after return");
      if (!semiResult.ok) return semiResult;
      return ok({ kind: "ReturnStmt", value });
    }
    if (at("keyword", "if")) {
      const exprResult = parsePrimary();
      if (!exprResult.ok) return exprResult;
      const expr = exprResult.value;
      if (expr.thenBranch?.kind === "Block") {
        return ok({ ...expr, kind: "IfStmt" });
      }
      const semiResult = expect(
        "symbol",
        ";",
        "Expected ';' after if expression statement",
      );
      if (!semiResult.ok) return semiResult;
      return ok({ kind: "ExprStmt", expr });
    }
    if (at("keyword", "while")) {
      eat();
      const openResult = expect("symbol", "(");
      if (!openResult.ok) return openResult;
      const conditionResult = parseExpression();
      if (!conditionResult.ok) return conditionResult;
      const closeResult = expect("symbol", ")");
      if (!closeResult.ok) return closeResult;
      const bodyResult = parseBlock();
      if (!bodyResult.ok) return bodyResult;
      return ok({
        kind: "WhileStmt",
        condition: conditionResult.value,
        body: bodyResult.value,
      });
    }
    if (at("keyword", "for")) return parseForStmt();
    if (at("keyword", "loop")) return parseLoopStmt();
    if (at("keyword", "lifetime")) return parseLifetimeStmt();
    if (at("keyword", "into")) {
      eat();
      const contractNameResult = parseIdentifier();
      if (!contractNameResult.ok) return contractNameResult;
      const semiResult = expect(
        "symbol",
        ";",
        "Expected ';' after into statement",
      );
      if (!semiResult.ok) return semiResult;
      return ok({ kind: "IntoStmt", contractName: contractNameResult.value });
    }
    if (at("keyword", "break")) {
      eat();
      const semiResult = expect("symbol", ";");
      if (!semiResult.ok) return semiResult;
      return ok({ kind: "BreakStmt" });
    }
    if (at("keyword", "continue")) {
      eat();
      const semiResult = expect("symbol", ";");
      if (!semiResult.ok) return semiResult;
      return ok({ kind: "ContinueStmt" });
    }
    if (at("symbol", "{")) return parseBlock();

    const exprResult = parseExpression();
    if (!exprResult.ok) return exprResult;
    const expr = exprResult.value;
    if (at("symbol", "=")) {
      eat();
      const valueResult = parseExpression();
      if (!valueResult.ok) return valueResult;
      const semiResult = expect("symbol", ";", "Expected ';' after assignment");
      if (!semiResult.ok) return semiResult;
      return ok({ kind: "AssignStmt", target: expr, value: valueResult.value });
    }
    if (at("symbol", ";")) {
      eat();
    } else if (!at("symbol", "}")) {
      const semiResult = expect(
        "symbol",
        ";",
        "Expected ';' after expression statement",
      );
      if (!semiResult.ok) return semiResult;
    }
    return ok({ kind: "ExprStmt", expr });
  };

  const body: Stmt[] = [];
  while (!at("eof")) {
    const stmtResult = parseStatement();
    if (!stmtResult.ok) return stmtResult;
    body.push(stmtResult.value);
  }

  return ok({ kind: "Program", body });
}
