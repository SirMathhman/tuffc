// @ts-nocheck
import { TuffError } from "./errors.ts";
import { err, ok, type Result } from "./result.ts";

type Loc = { line?: number; column?: number; filePath?: string } | null;
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

    if (at("symbol", "*")) {
      eat();
      const mutable = at("keyword", "mut") ? !!eat() : false;
      const toResult = parseType();
      if (!toResult.ok) return toResult;
      return ok({ kind: "PointerType", mutable, to: toResult.value });
    }

    if (at("symbol", "[")) {
      eat();
      const elementResult = parseType();
      if (!elementResult.ok) return elementResult;
      let init = null;
      let total = null;
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

    const firstIdResult = expect("identifier", undefined, "Expected type name");
    if (!firstIdResult.ok) return firstIdResult;
    const nameParts = [firstIdResult.value.value as string];
    while (at("symbol", "::")) {
      eat();
      const partResult = parseIdentifier();
      if (!partResult.ok) return partResult;
      nameParts.push(partResult.value);
    }
    const genericArgs: Expr[] = [];
    if (at("symbol", "<") && canStartTypeToken(peek(1))) {
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
    let typeExpr: Expr = {
      kind: "NamedType",
      name: nameParts.join("::"),
      genericArgs,
    };

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
      const rightResult = parseType();
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
    if (at("number"))
      return ok({ kind: "LiteralPattern", value: Number(eat().value) });
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
    if (at("number")) {
      const t = eat();
      return parsePostfix({
        kind: "NumberLiteral",
        value: Number(t.value),
        loc: t.loc,
        start: t.start,
        end: t.end,
      });
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
      let elseBranch = null;
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
    if (at("symbol", "!") || at("symbol", "-")) {
      const tok = eat();
      const innerResult = parseUnary();
      if (!innerResult.ok) return innerResult;
      const inner = innerResult.value;
      return ok({
        kind: "UnaryExpr",
        op: tok.value,
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
    let type = null;
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
    const generics: string[] = [];
    if (at("symbol", "<")) {
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
      const closeResult = expect("symbol", ">", "Expected '>' after generics");
      if (!closeResult.ok) return closeResult;
    }

    const openResult = expect(
      "symbol",
      "(",
      "Expected '(' in function declaration",
    );
    if (!openResult.ok) return openResult;
    const params: { name: string; type: Expr | null }[] = [];
    if (!at("symbol", ")")) {
      while (true) {
        const paramNameResult = parseIdentifier();
        if (!paramNameResult.ok) return paramNameResult;
        let paramType = null;
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
    const closeResult = expect("symbol", ")", "Expected ')' after params");
    if (!closeResult.ok) return closeResult;

    let returnType = null;
    if (at("symbol", ":")) {
      eat();
      const returnTypeResult = parseType();
      if (!returnTypeResult.ok) return returnTypeResult;
      returnType = returnTypeResult.value;
    }

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

  const parseStruct = (): ParseResult<Stmt> => {
    const structResult = expect("keyword", "struct");
    if (!structResult.ok) return structResult;
    const nameResult = parseIdentifier();
    if (!nameResult.ok) return nameResult;
    const generics: string[] = [];
    if (at("symbol", "<")) {
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
      const closeResult = expect("symbol", ">", "Expected '>'");
      if (!closeResult.ok) return closeResult;
    }
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
    return ok({ kind: "StructDecl", name: nameResult.value, generics, fields });
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

  const parseTypeAlias = (): ParseResult<Stmt> => {
    const typeResult = expect("keyword", "type");
    if (!typeResult.ok) return typeResult;
    const nameResult = parseIdentifier();
    if (!nameResult.ok) return nameResult;
    const generics: string[] = [];
    if (at("symbol", "<")) {
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
      const closeResult = expect(
        "symbol",
        ">",
        "Expected '>' after alias generics",
      );
      if (!closeResult.ok) return closeResult;
    }
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
    if (at("keyword", "out")) {
      const outTok = eat();
      if (at("keyword", "fn")) {
        const nodeResult = parseFunction(false);
        if (!nodeResult.ok) return nodeResult;
        const node = nodeResult.value;
        node.exported = true;
        node.loc = node.loc ?? outTok.loc;
        return ok(node);
      }
      if (at("keyword", "struct")) {
        const nodeResult = parseStruct();
        if (!nodeResult.ok) return nodeResult;
        const node = nodeResult.value;
        node.exported = true;
        node.loc = node.loc ?? outTok.loc;
        return ok(node);
      }
      if (at("keyword", "enum")) {
        const nodeResult = parseEnum();
        if (!nodeResult.ok) return nodeResult;
        const node = nodeResult.value;
        node.exported = true;
        node.loc = node.loc ?? outTok.loc;
        return ok(node);
      }
      if (at("keyword", "type")) {
        const nodeResult = parseTypeAlias();
        if (!nodeResult.ok) return nodeResult;
        const node = nodeResult.value;
        node.exported = true;
        node.loc = node.loc ?? outTok.loc;
        return ok(node);
      }
      if (at("keyword", "class")) {
        eat();
        const nodeResult = parseFunction(true);
        if (!nodeResult.ok) return nodeResult;
        const node = nodeResult.value;
        node.exported = true;
        node.loc = node.loc ?? outTok.loc;
        return ok(node);
      }
      return err(
        new TuffError("Expected declaration after 'out'", peek().loc, {
          code: "E_PARSE_EXPECTED_TOKEN",
          hint: "Use 'out' before a top-level fn/struct/enum/type/class declaration.",
        }),
      );
    }

    if (at("keyword", "let")) return parseLetDecl();
    if (at("keyword", "struct")) return parseStruct();
    if (at("keyword", "enum")) return parseEnum();
    if (at("keyword", "type")) return parseTypeAlias();
    if (at("keyword", "fn")) return parseFunction(false);
    if (at("keyword", "extern")) {
      eat();
      if (at("keyword", "fn")) {
        const fnKeywordResult = expect("keyword", "fn", "Expected fn");
        if (!fnKeywordResult.ok) return fnKeywordResult;
        const nameResult = parseIdentifier();
        if (!nameResult.ok) return nameResult;
        const generics: string[] = [];
        if (at("symbol", "<")) {
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
          const closeResult = expect(
            "symbol",
            ">",
            "Expected '>' after generics",
          );
          if (!closeResult.ok) return closeResult;
        }
        const openResult = expect("symbol", "(", "Expected '('");
        if (!openResult.ok) return openResult;
        const params: { name: string; type: Expr | null }[] = [];
        if (!at("symbol", ")")) {
          while (true) {
            const paramNameResult = parseIdentifier();
            if (!paramNameResult.ok) return paramNameResult;
            let paramType = null;
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
        const closeResult = expect("symbol", ")", "Expected ')'");
        if (!closeResult.ok) return closeResult;
        let returnType = null;
        if (at("symbol", ":")) {
          eat();
          const returnTypeResult = parseType();
          if (!returnTypeResult.ok) return returnTypeResult;
          returnType = returnTypeResult.value;
        }
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
          body: null,
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
        const generics: string[] = [];
        if (at("symbol", "<")) {
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
          const closeResult = expect(
            "symbol",
            ">",
            "Expected '>' after extern type generics",
          );
          if (!closeResult.ok) return closeResult;
        }
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
      let value = null;
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
