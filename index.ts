export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => {
  return { ok: true, value };
};

export const err = <E>(error: E): Result<never, E> => {
  return { ok: false, error };
};

const isValidTypeStr = (typeStr: string): boolean => {
  return (
    (typeStr[0] === "U" || typeStr[0] === "I") &&
    typeStr
      .substring(1)
      .split("")
      .every((c: string) => c >= "0" && c <= "9")
  );
};

export const compile = (source: string): Result<string, string> => {
  // Empty input returns 0
  if (source === "") {
    return ok("return 0");
  }

  // Variable declarations (let x : Type = expr; or let x = expr;)
  if (source.includes("let ")) {
    const declarations: Record<string, string> = {};
    const declarationTypes: Record<string, string> = {};
    let returnExpr = "";

    for (const stmt of source.split(";").map((s) => s.trim())) {
      if (stmt.startsWith("let ")) {
        const afterLet = stmt.substring(4);
        const colonIdx = afterLet.indexOf(":");
        const equalIdx = afterLet.indexOf("=");

        if (equalIdx === -1) {
          return err("Invalid variable declaration: missing initializer");
        }

        const isTyped = colonIdx !== -1 && colonIdx < equalIdx;
        const declaredType = isTyped
          ? afterLet.substring(colonIdx + 1, equalIdx).trim()
          : "";
        const valueExpr = afterLet
          .substring(
            isTyped ? afterLet.indexOf("=", colonIdx) + 1 : equalIdx + 1,
          )
          .trim();

        let compiledValue: string;
        if (valueExpr in declarations) {
          compiledValue = valueExpr;
        } else {
          const compileResult = compile(valueExpr);
          if (!compileResult.ok) {
            return compileResult;
          }

          const returnValue = compileResult.value;
          if (!returnValue.startsWith("return ")) {
            return err("Invalid variable initialization");
          }

          compiledValue = returnValue.substring(7).endsWith(";")
            ? returnValue.substring(7, returnValue.length - 1)
            : returnValue.substring(7);
        }

        if (isTyped && declaredType) {
          if (!isValidTypeStr(declaredType)) {
            return err(`Invalid type: ${declaredType}`);
          }

          let valueType = "";
          const typeMarkerIdx = Math.max(
            valueExpr.lastIndexOf("U"),
            valueExpr.lastIndexOf("I"),
          );

          if (typeMarkerIdx > 0 && typeMarkerIdx < valueExpr.length - 1) {
            if (
              valueExpr
                .substring(0, typeMarkerIdx)
                .split("")
                .every((c) => c >= "0" && c <= "9") &&
              valueExpr
                .substring(typeMarkerIdx + 1)
                .split("")
                .every((c) => c >= "0" && c <= "9")
            ) {
              valueType = valueExpr.substring(typeMarkerIdx);
            }
          }

          if (!valueType) {
            if (valueExpr.startsWith("read<") && valueExpr.endsWith(">()")) {
              const typeEnd = valueExpr.indexOf(">");
              if (typeEnd > 5) {
                valueType = valueExpr.substring(5, typeEnd);
              }
            }
          }
          if (!valueType && valueExpr in declarationTypes) {
            valueType = declarationTypes[valueExpr];
          }
          if (
            valueType &&
            !(
              declaredType[0] === valueType[0] &&
              parseInt(valueType.substring(1), 10) <=
                parseInt(declaredType.substring(1), 10)
            )
          ) {
            return err(`Cannot assign ${valueType} to ${declaredType}`);
          }
        }

        const varName = afterLet
          .substring(0, isTyped ? colonIdx : equalIdx)
          .trim();
        if (varName in declarations) {
          return err(`Variable '${varName}' is already declared`);
        }

        declarations[varName] = compiledValue;
        if (isTyped && declaredType) {
          declarationTypes[varName] = declaredType;
        } else if (valueExpr in declarationTypes) {
          declarationTypes[varName] = declarationTypes[valueExpr];
        } else if (valueExpr.startsWith("read<") && valueExpr.endsWith(">()")) {
          const typeEnd = valueExpr.indexOf(">");
          if (typeEnd > 5)
            declarationTypes[varName] = valueExpr.substring(5, typeEnd);
        } else {
          const tIdx = Math.max(
            valueExpr.lastIndexOf("U"),
            valueExpr.lastIndexOf("I"),
          );
          if (
            tIdx > 0 &&
            valueExpr
              .substring(0, tIdx)
              .split("")
              .every((c) => c >= "0" && c <= "9") &&
            valueExpr
              .substring(tIdx + 1)
              .split("")
              .every((c) => c >= "0" && c <= "9")
          ) {
            declarationTypes[varName] = valueExpr.substring(tIdx);
          }
        }
      } else if (stmt.length > 0) {
        returnExpr = stmt;
      }
    }

    if (!returnExpr) {
      returnExpr = "0";
    }

    return ok(
      Object.entries(declarations)
        .map(([name, value]) => `let ${name} = ${value};`)
        .join("\n") +
        "\nreturn " +
        returnExpr +
        ";",
    );
  }

  // Binary expressions with operators
  if (
    source.includes("+") ||
    source.includes("-") ||
    source.includes("*") ||
    source.includes("/")
  ) {
    let result = source;

    // Replace all read<Type>() patterns with read()
    while (result.includes("read<")) {
      const start = result.indexOf("read<");
      const typeEnd = result.indexOf(">", start + 5);
      const parenStart = result.indexOf("(", typeEnd);

      if (
        typeEnd === -1 ||
        parenStart === -1 ||
        result[parenStart + 1] !== ")"
      ) {
        return err("Invalid read syntax in expression");
      }

      if (!isValidTypeStr(result.substring(start + 5, typeEnd))) {
        return err("Invalid type in read<> expression");
      }

      result =
        result.substring(0, start) +
        "read()" +
        result.substring(parenStart + 2);
    }

    // Validate the resulting expression contains only valid characters
    for (let i = 0; i < result.length; i++) {
      if (!"0123456789+-*/ ()read".includes(result[i])) {
        return err("Invalid character in expression");
      }
    }

    return ok(`return ${result};`);
  }

  // read<Type>() - read from stdin
  if (source.startsWith("read<") && source.endsWith(">()")) {
    const typeEnd = source.indexOf(">");
    if (typeEnd > 5) {
      if (isValidTypeStr(source.substring(5, typeEnd))) {
        return ok("return read();");
      }
    }
    return err("Invalid read syntax");
  }

  // Numeric literals with optional type suffixes (e.g., 100U8, 100I32)
  // Must start with a digit
  if (source.length > 0 && source[0] >= "0" && source[0] <= "9") {
    let i = 0;
    while (i < source.length && source[i] >= "0" && source[i] <= "9") {
      i++;
    }
    const numValue = source.substring(0, i);
    const typeSuffix = source.substring(i);

    if (
      !(
        typeSuffix.length === 0 ||
        (typeSuffix.length >= 2 &&
          typeSuffix.length <= 3 &&
          (typeSuffix[0] === "U" || typeSuffix[0] === "I") &&
          typeSuffix
            .split("")
            .slice(1)
            .every((c) => c >= "0" && c <= "9"))
      )
    ) {
      return err("Not implemented yet");
    }

    // Validate value fits in type
    if (typeSuffix.length > 0) {
      const typeChar = typeSuffix[0];
      const bitWidth = parseInt(typeSuffix.substring(1), 10);
      if (
        BigInt(numValue) >
        (BigInt(1) << BigInt(typeChar === "U" ? bitWidth : bitWidth - 1)) -
          BigInt(1)
      ) {
        return err(
          `Value ${numValue} exceeds maximum for ${typeChar}${bitWidth}`,
        );
      }
    }

    return ok(`return ${numValue}`);
  }

  // Invalid input returns error
  if (
    source.length > 0 &&
    ((source[0] >= "a" && source[0] <= "z") ||
      (source[0] >= "A" && source[0] <= "Z") ||
      source[0] === "_")
  ) {
    return err("Invalid input");
  }

  return err("Not implemented yet");
};
