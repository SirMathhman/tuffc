import { TuffError } from "./errors.js";

export function parse(tokens) {
  let i = 0;

  const peek = (n = 0) => tokens[i + n] ?? tokens[tokens.length - 1];
  const at = (type, value = undefined) => {
    const t = peek();
    if (t.type !== type) return false;
    return value === undefined || t.value === value;
  };
  const eat = () => tokens[i++];
  const expect = (type, value = undefined, message = "Unexpected token") => {
    const t = peek();
    if (!at(type, value)) {
      throw new TuffError(message + `, got ${t.type}:${t.value}`, t.loc, {
        code: "E_PARSE_EXPECTED_TOKEN",
        hint: "Check token order, punctuation, and delimiters around this location.",
      });
    }
    return eat();
  };

  const parseIdentifierToken = () =>
    expect("identifier", undefined, "Expected identifier");

  const parseIdentifier = () => parseIdentifierToken().value;

  const parseType = () => {
    const canStartTypeToken = (tok) => {
      if (!tok) return false;
      if (tok.type === "identifier") return true;
      if (tok.type === "symbol" && ["*", "[", "("].includes(tok.value))
        return true;
      return false;
    };

    const canStartRefinementExpr = (tok) => {
      if (!tok) return false;
      if (["number", "identifier", "bool", "string", "char"].includes(tok.type))
        return true;
      if (tok.type === "symbol" && ["(", "-", "!"].includes(tok.value))
        return true;
      return false;
    };

    if (at("symbol", "*")) {
      eat();
      const mutable = at("keyword", "mut") ? !!eat() : false;
      return { kind: "PointerType", mutable, to: parseType() };
    }

    if (at("symbol", "[")) {
      eat();
      const element = parseType();
      let init = null;
      let total = null;
      if (at("symbol", ";")) {
        eat();
        init = parseExpression();
        expect("symbol", ";", "Expected ';' in array type");
        total = parseExpression();
      }
      expect("symbol", "]", "Expected ']' after array type");
      return { kind: "ArrayType", element, init, total };
    }

    if (at("symbol", "(")) {
      eat();
      const members = [];
      if (!at("symbol", ")")) {
        do {
          members.push(parseType());
          if (!at("symbol", ",")) break;
          eat();
        } while (true);
      }
      expect("symbol", ")", "Expected ')' for tuple type");
      return { kind: "TupleType", members };
    }

    const nameParts = [
      expect("identifier", undefined, "Expected type name").value,
    ];
    while (at("symbol", "::")) {
      eat();
      nameParts.push(parseIdentifier());
    }
    let genericArgs = [];
    if (at("symbol", "<") && canStartTypeToken(peek(1))) {
      eat();
      if (!at("symbol", ">")) {
        do {
          genericArgs.push(parseType());
          if (!at("symbol", ",")) break;
          eat();
        } while (true);
      }
      expect("symbol", ">", "Expected '>' in generic args");
    }
    let typeExpr = {
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
      const op = eat().value;
      const valueExpr = parseExpression();
      typeExpr = { kind: "RefinementType", base: typeExpr, op, valueExpr };
    }

    while (at("symbol", "|") || at("symbol", "|>")) {
      const unionOp = eat().value;
      const right = parseType();
      typeExpr = {
        kind: "UnionType",
        left: typeExpr,
        right,
        extractFromLeft: unionOp === "|>",
      };
    }
    return typeExpr;
  };

  const parseBlock = () => {
    const start = expect("symbol", "{", "Expected '{'").loc;
    const statements = [];
    while (!at("symbol", "}") && !at("eof")) {
      statements.push(parseStatement());
    }
    expect("symbol", "}", "Expected '}'");
    return { kind: "Block", statements, loc: start };
  };

  const precedence = {
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

  const parsePattern = () => {
    if (at("symbol", "_") || at("identifier", "_")) {
      eat();
      return { kind: "WildcardPattern" };
    }
    if (at("number"))
      return { kind: "LiteralPattern", value: Number(eat().value) };
    if (at("bool")) return { kind: "LiteralPattern", value: !!eat().value };
    if (at("string")) return { kind: "LiteralPattern", value: eat().value };

    const name = parseIdentifier();
    if (at("symbol", "{")) {
      eat();
      const fields = [];
      if (!at("symbol", "}")) {
        do {
          const field = parseIdentifier();
          fields.push({ field, bind: field });
          if (!at("symbol", ",")) break;
          eat();
        } while (true);
      }
      expect("symbol", "}", "Expected '}' in pattern");
      return { kind: "StructPattern", name, fields };
    }
    return { kind: "NamePattern", name };
  };

  const parsePostfix = (baseExpr) => {
    let expr = baseExpr;
    while (true) {
      if (at("symbol", "(")) {
        eat();
        const args = [];
        if (!at("symbol", ")")) {
          do {
            args.push(parseExpression());
            if (!at("symbol", ",")) break;
            eat();
          } while (true);
        }
        const closeTok = expect("symbol", ")", "Expected ')' after call args");

        if (expr.kind === "MemberExpr") {
          // Receiver-call sugar: value.method(a, b) => method(value, a, b)
          expr = {
            kind: "CallExpr",
            callee: { kind: "Identifier", name: expr.property, loc: expr.loc },
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
        const propTok = parseIdentifierToken();
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
        const index = parseExpression();
        const closeTok = expect("symbol", "]", "Expected ']' after index");
        expr = {
          kind: "IndexExpr",
          target: expr,
          index,
          loc: expr.loc,
          start: expr.start,
          end: closeTok.end,
        };
        continue;
      }
      break;
    }
    return expr;
  };

  const parsePrimary = () => {
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
      const expr = parseExpression();
      expect("symbol", ")", "Expected ')' after expression");
      return parsePostfix(expr);
    }

    if (at("keyword", "if")) {
      const start = eat().loc;
      expect("symbol", "(", "Expected '(' after if");
      const condition = parseExpression();
      expect("symbol", ")", "Expected ')' after if condition");
      const thenBranch = at("symbol", "{") ? parseBlock() : parseExpression();
      let elseBranch = null;
      if (at("keyword", "else")) {
        eat();
        elseBranch = at("symbol", "{") ? parseBlock() : parseExpression();
      }
      return parsePostfix({
        kind: "IfExpr",
        condition,
        thenBranch,
        elseBranch,
        loc: start,
      });
    }

    if (at("keyword", "match")) {
      const start = eat().loc;
      expect("symbol", "(", "Expected '(' after match");
      const target = parseExpression();
      expect("symbol", ")", "Expected ')' after match target");
      expect("symbol", "{", "Expected '{' for match");
      const cases = [];
      while (!at("symbol", "}")) {
        expect("keyword", "case", "Expected case in match");
        const pattern = parsePattern();
        expect("symbol", "=", "Expected '=' after case pattern");
        const body = at("symbol", "{") ? parseBlock() : parseExpression();
        expect("symbol", ";", "Expected ';' after case body");
        cases.push({ pattern, body });
      }
      expect("symbol", "}", "Expected '}' for match");
      return parsePostfix({ kind: "MatchExpr", target, cases, loc: start });
    }

    if (at("identifier")) {
      const idTok = eat();
      let expr = {
        kind: "Identifier",
        name: idTok.value,
        loc: idTok.loc,
        start: idTok.start,
        end: idTok.end,
      };

      if (at("symbol", "{")) {
        eat();
        const fields = [];
        if (!at("symbol", "}")) {
          do {
            const key = parseIdentifier();
            expect("symbol", ":", "Expected ':' in struct init");
            const value = parseExpression();
            fields.push({ key, value });
            if (!at("symbol", ",")) break;
            eat();
          } while (true);
        }
        expect("symbol", "}", "Expected '}' in struct init");
        expr = {
          kind: "StructInit",
          name: idTok.value,
          fields,
          loc: idTok.loc,
        };
      }

      return parsePostfix(expr);
    }

    throw new TuffError(
      `Unexpected token ${peek().type}:${peek().value}`,
      peek().loc,
      {
        code: "E_PARSE_UNEXPECTED_TOKEN",
        hint: "Ensure expressions and statements use valid Tuff-lite syntax.",
      },
    );
  };

  const parseUnary = () => {
    if (at("symbol", "!") || at("symbol", "-")) {
      const tok = eat();
      const inner = parseUnary();
      return {
        kind: "UnaryExpr",
        op: tok.value,
        expr: inner,
        loc: tok.loc,
        start: tok.start,
        end: inner?.end ?? tok.end,
      };
    }
    return parsePrimary();
  };

  const parseExpression = (minPrec = 0) => {
    let left = parseUnary();
    while (true) {
      const t = peek();
      const op = t.type === "keyword" ? t.value : t.value;
      const prec = precedence[op];
      if (prec === undefined || prec < minPrec) break;
      eat();
      if (op === "is") {
        const pattern = parsePattern();
        left = {
          kind: "IsExpr",
          expr: left,
          pattern,
          loc: left.loc ?? t.loc,
          start: left?.start,
          end: left?.end,
        };
      } else {
        const right = parseExpression(prec + 1);
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
    return left;
  };

  const parseLetDecl = () => {
    const start = expect("keyword", "let").loc;
    if (at("symbol", "{")) {
      eat();
      const names = [];
      if (!at("symbol", "}")) {
        do {
          names.push(parseIdentifier());
          if (!at("symbol", ",")) break;
          eat();
        } while (true);
      }
      expect("symbol", "}", "Expected '}' in destructuring import");
      expect("symbol", "=", "Expected '=' in import-style let");
      const moduleParts = [parseIdentifier()];
      while (at("symbol", "::")) {
        eat();
        moduleParts.push(parseIdentifier());
      }
      expect("symbol", ";", "Expected ';' after import-style let");
      return {
        kind: "ImportDecl",
        names,
        modulePath: moduleParts.join("::"),
        loc: start,
      };
    }

    const name = parseIdentifier();
    let type = null;
    if (at("symbol", ":")) {
      eat();
      type = parseType();
    }
    expect("symbol", "=", "Expected '=' in let declaration");
    const value = parseExpression();
    expect("symbol", ";", "Expected ';' after let declaration");
    return { kind: "LetDecl", name, type, value, loc: start };
  };

  const parseFunction = (isClassSugar = false) => {
    expect("keyword", "fn", "Expected fn");
    const name = parseIdentifier();
    const generics = [];
    if (at("symbol", "<")) {
      eat();
      if (!at("symbol", ">")) {
        do {
          generics.push(parseIdentifier());
          if (!at("symbol", ",")) break;
          eat();
        } while (true);
      }
      expect("symbol", ">", "Expected '>' after generics");
    }

    expect("symbol", "(", "Expected '(' in function declaration");
    const params = [];
    if (!at("symbol", ")")) {
      do {
        const paramName = parseIdentifier();
        let paramType = null;
        if (at("symbol", ":")) {
          eat();
          paramType = parseType();
        }
        params.push({ name: paramName, type: paramType });
        if (!at("symbol", ",")) break;
        eat();
      } while (true);
    }
    expect("symbol", ")", "Expected ')' after params");

    let returnType = null;
    if (at("symbol", ":")) {
      eat();
      returnType = parseType();
    }

    expect("symbol", "=>", "Expected '=>' in function declaration");
    const body = at("symbol", "{") ? parseBlock() : parseExpression();
    if (!at("symbol", "}") && !at("eof") && body.kind !== "Block") {
      expect("symbol", ";", "Expected ';' after expression function");
    }
    return {
      kind: isClassSugar ? "ClassFunctionDecl" : "FnDecl",
      name,
      generics,
      params,
      returnType,
      body,
    };
  };

  const parseStruct = () => {
    expect("keyword", "struct");
    const name = parseIdentifier();
    let generics = [];
    if (at("symbol", "<")) {
      eat();
      if (!at("symbol", ">")) {
        do {
          generics.push(parseIdentifier());
          if (!at("symbol", ",")) break;
          eat();
        } while (true);
      }
      expect("symbol", ">", "Expected '>'");
    }
    expect("symbol", "{");
    const fields = [];
    while (!at("symbol", "}")) {
      const fieldName = parseIdentifier();
      expect("symbol", ":", "Expected ':' in struct field");
      const fieldType = parseType();
      fields.push({ name: fieldName, type: fieldType });
      if (at("symbol", ",") || at("symbol", ";")) eat();
    }
    expect("symbol", "}");
    return { kind: "StructDecl", name, generics, fields };
  };

  const parseEnum = () => {
    expect("keyword", "enum");
    const name = parseIdentifier();
    expect("symbol", "{", "Expected '{' after enum name");
    const variants = [];
    while (!at("symbol", "}")) {
      variants.push(parseIdentifier());
      if (at("symbol", ",") || at("symbol", ";")) eat();
    }
    expect("symbol", "}", "Expected '}' after enum body");
    return { kind: "EnumDecl", name, variants };
  };

  const parseTypeAlias = () => {
    expect("keyword", "type");
    const name = parseIdentifier();
    let generics = [];
    if (at("symbol", "<")) {
      eat();
      if (!at("symbol", ">")) {
        do {
          generics.push(parseIdentifier());
          if (!at("symbol", ",")) break;
          eat();
        } while (true);
      }
      expect("symbol", ">", "Expected '>' after alias generics");
    }
    expect("symbol", "=", "Expected '=' for type alias");
    const aliasedType = parseType();
    expect("symbol", ";", "Expected ';' after type alias");
    return { kind: "TypeAlias", name, generics, aliasedType };
  };

  const parseForStmt = () => {
    expect("keyword", "for");
    expect("symbol", "(");
    const iterator = parseIdentifier();
    expect("keyword", "in", "Expected 'in' in for loop");
    const start = parseExpression();
    expect("symbol", "..", "Expected '..' in for range");
    const end = parseExpression();
    expect("symbol", ")", "Expected ')' after for header");
    const body = parseBlock();
    return { kind: "ForStmt", iterator, start, end, body };
  };

  const parseStatement = () => {
    if (at("keyword", "let")) return parseLetDecl();
    if (at("keyword", "struct")) return parseStruct();
    if (at("keyword", "enum")) return parseEnum();
    if (at("keyword", "type")) return parseTypeAlias();
    if (at("keyword", "fn")) return parseFunction(false);
    if (at("keyword", "extern")) {
      eat();
      if (at("keyword", "fn")) {
        expect("keyword", "fn", "Expected fn");
        const name = parseIdentifier();
        const generics = [];
        if (at("symbol", "<")) {
          eat();
          if (!at("symbol", ">")) {
            do {
              generics.push(parseIdentifier());
              if (!at("symbol", ",")) break;
              eat();
            } while (true);
          }
          expect("symbol", ">", "Expected '>' after generics");
        }
        expect("symbol", "(", "Expected '('");
        const params = [];
        if (!at("symbol", ")")) {
          do {
            const paramName = parseIdentifier();
            let paramType = null;
            if (at("symbol", ":")) {
              eat();
              paramType = parseType();
            }
            params.push({ name: paramName, type: paramType });
            if (!at("symbol", ",")) break;
            eat();
          } while (true);
        }
        expect("symbol", ")", "Expected ')'");
        let returnType = null;
        if (at("symbol", ":")) {
          eat();
          returnType = parseType();
        }
        expect("symbol", ";", "Expected ';' after extern fn");
        return {
          kind: "ExternFnDecl",
          name,
          generics,
          params,
          returnType,
          body: null,
        };
      }
      if (at("keyword", "let")) {
        const start = expect("keyword", "let").loc;
        const name = parseIdentifier();
        expect("symbol", ":", "Expected ':' in extern let");
        const type = parseType();
        expect("symbol", ";", "Expected ';' after extern let");
        return { kind: "ExternLetDecl", name, type, loc: start };
      }
      if (at("keyword", "type")) {
        eat();
        const name = parseIdentifier();
        expect("symbol", ";", "Expected ';' after extern type");
        return { kind: "ExternTypeDecl", name };
      }
      throw new TuffError(
        "Expected 'fn', 'let', or 'type' after 'extern'",
        peek().loc,
      );
    }
    if (at("keyword", "class")) {
      eat();
      return parseFunction(true);
    }
    if (at("keyword", "return")) {
      eat();
      const value = at("symbol", ";") ? null : parseExpression();
      expect("symbol", ";", "Expected ';' after return");
      return { kind: "ReturnStmt", value };
    }
    if (at("keyword", "if")) {
      const expr = parsePrimary();
      if (expr.thenBranch?.kind === "Block") {
        return { ...expr, kind: "IfStmt" };
      }
      expect("symbol", ";", "Expected ';' after if expression statement");
      return { kind: "ExprStmt", expr };
    }
    if (at("keyword", "while")) {
      eat();
      expect("symbol", "(");
      const condition = parseExpression();
      expect("symbol", ")");
      const body = parseBlock();
      return { kind: "WhileStmt", condition, body };
    }
    if (at("keyword", "for")) return parseForStmt();
    if (at("keyword", "break")) {
      eat();
      expect("symbol", ";");
      return { kind: "BreakStmt" };
    }
    if (at("keyword", "continue")) {
      eat();
      expect("symbol", ";");
      return { kind: "ContinueStmt" };
    }
    if (at("symbol", "{")) return parseBlock();

    const expr = parseExpression();
    if (at("symbol", "=")) {
      eat();
      const value = parseExpression();
      expect("symbol", ";", "Expected ';' after assignment");
      return { kind: "AssignStmt", target: expr, value };
    }
    if (at("symbol", ";")) {
      eat();
    } else if (!at("symbol", "}")) {
      expect("symbol", ";", "Expected ';' after expression statement");
    }
    return { kind: "ExprStmt", expr };
  };

  const body = [];
  while (!at("eof")) {
    body.push(parseStatement());
  }

  return { kind: "Program", body };
}
