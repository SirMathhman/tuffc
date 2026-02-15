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
        const mutable = at("keyword", "mut") ? !!eat() : false;
        const toResult = parseTypePrimary();
        if (!toResult.ok) return toResult;
        return ok({ kind: "PointerType", mutable, to: toResult.value });
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
            const memberResult = parseType();
            if (!memberResult.ok) return memberResult;
            members.push(memberResult.value);
            if (!at("symbol", ",")) break;
            eat();
          }
        }
        const close = expect("symbol", ")", "Expected ')' for tuple type");
        if (!close.ok) return close;
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

    if (
      (at("symbol", "!=") ||
        at("symbol", "<") ||
        at("symbol", ">") ||
        at("symbol", "<=") ||
        at("symbol", ">=")) &&
      canStartRefinementExpr(peek(1))
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
        const propResult = parseIdentifierToken();
        if (!propResult.ok) return propResult;
        const propTok = propResult.value;
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
      break;
    }
    return ok(expr);
  };

  const parsePrimary = (): ParseResult<Expr> => {
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
      const idTok = eat();
      let expr: Expr = {
        kind: "Identifier",
        name: idTok.value,
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
    if (at("symbol", "?")) {
      const tok = eat();
      left = {
        kind: "UnwrapExpr",
        expr: left,
        loc: left.loc,
        start: left?.start,
        end: tok.end,
      };
    }
    return ok(left);
  };

  const parseLetDecl = (): ParseResult<Stmt> => {
    const startResult = expect("keyword", "let");
    if (!startResult.ok) return startResult;
    const start = startResult.value.loc;
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
      loc: start,
    });
  };

  const parseFunction = (isClassSugar = false): ParseResult<Stmt> => {
    const fnResult = expect("keyword", "fn", "Expected fn");
    if (!fnResult.ok) return fnResult;
    const nameResult = parseIdentifier();
    if (!nameResult.ok) return nameResult;
    const genericsResult = parseGenericParams("Expected '>' after generics");
    if (!genericsResult.ok) return genericsResult;
    const generics = genericsResult.value;

    const signatureResult = parseFunctionSignature(
      "Expected '(' in function declaration",
      "Expected ')' after params",
    );
    if (!signatureResult.ok) return signatureResult;
    const { params, returnType } = signatureResult.value;

    const arrowResult = expect(
      "symbol",
      "=>",
      "Expected '=>' in function declaration",
    );
    if (!arrowResult.ok) return arrowResult;
    const bodyResult = at("symbol", "{") ? parseBlock() : parseExpression();
    if (!bodyResult.ok) return bodyResult;
    if (!at("symbol", "}") && !at("eof") && bodyResult.value.kind !== "Block") {
      const semiResult = expect(
        "symbol",
        ";",
        "Expected ';' after expression function",
      );
      if (!semiResult.ok) return semiResult;
    }
    return ok({
      kind: isClassSugar ? "ClassFunctionDecl" : "FnDecl",
      name: nameResult.value,
      generics,
      params,
      returnType,
      body: bodyResult.value,
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
    const semiResult = expect("symbol", ";", "Expected ';' after type alias");
    if (!semiResult.ok) return semiResult;
    return ok({
      kind: "TypeAlias",
      name: nameResult.value,
      generics,
      aliasedType: aliasedTypeResult.value,
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

  const parseStatement = (): ParseResult<Stmt> => {
    let exported = false;
    let copyDecl = false;
    let modifierLoc = undefined;
    let consumedModifier = false;
    while (at("keyword", "out") || at("keyword", "copy")) {
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
        if (copyDecl) {
          return err(
            new TuffError("Duplicate 'copy' modifier", tok.loc, {
              code: "E_PARSE_EXPECTED_TOKEN",
              hint: "Use 'copy' at most once before a declaration.",
            }),
          );
        }
        copyDecl = true;
      }
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
        nodeResult = parseFunction(false);
      } else if (at("keyword", "struct")) {
        nodeResult = parseStruct(copyDecl);
      } else if (at("keyword", "enum")) {
        nodeResult = parseEnum();
      } else if (at("keyword", "type")) {
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
