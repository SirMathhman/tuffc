export class CompileError extends Error {
  // Code snippet of what was invalid, should ideally be a few lines of code to give context to the error.
  erroneousCode: string;

  // Reason why this is an error. Discuss the syntax more generally, and why the language is designed in this particular way.
  reason: string;

  // A suggested fix for this.
  fix: string;

  constructor(
    message: string,
    erroneousCode: string,
    reason: string,
    fix: string,
  ) {
    super(message);
    this.erroneousCode = erroneousCode;
    this.reason = reason;
    this.fix = fix;
  }
}

function validateTypeRange(
  suffix: string,
  value: number,
  source: string,
): void {
  const validTypes = [
    "U8",
    "U16",
    "U32",
    "U64",
    "I8",
    "I16",
    "I32",
    "I64",
    "USize",
  ];

  if (suffix === "" || validTypes.includes(suffix)) {
    if (suffix === "U8" && (value < 0 || value > 255)) {
      throw new CompileError(
        "U8 literal out of range",
        source,
        "U8 is an unsigned 8-bit integer with a valid range of 0 to 255",
        "Use a value between 0 and 255",
      );
    } else if (suffix === "I8" && (value < -128 || value > 127)) {
      throw new CompileError(
        "I8 literal out of range",
        source,
        "I8 is a signed 8-bit integer with a valid range of -128 to 127",
        "Use a value between -128 and 127",
      );
    } else if (suffix === "U16" && (value < 0 || value > 65535)) {
      throw new CompileError(
        "U16 literal out of range",
        source,
        "U16 is an unsigned 16-bit integer with a valid range of 0 to 65535",
        "Use a value between 0 and 65535",
      );
    } else if (suffix === "I16" && (value < -32768 || value > 32767)) {
      throw new CompileError(
        "I16 literal out of range",
        source,
        "I16 is a signed 16-bit integer with a valid range of -32768 to 32767",
        "Use a value between -32768 and 32767",
      );
    } else if (suffix === "U32" && (value < 0 || value > 4294967295)) {
      throw new CompileError(
        "U32 literal out of range",
        source,
        "U32 is an unsigned 32-bit integer with a valid range of 0 to 4294967295",
        "Use a value between 0 and 4294967295",
      );
    } else if (
      suffix === "I32" &&
      (value < -2147483648 || value > 2147483647)
    ) {
      throw new CompileError(
        "I32 literal out of range",
        source,
        "I32 is a signed 32-bit integer with a valid range of -2147483648 to 2147483647",
        "Use a value between -2147483648 and 2147483647",
      );
    } else if (suffix === "USize" && value < 0) {
      throw new CompileError(
        "USize literal out of range",
        source,
        "USize is an unsigned size type with a valid range of 0 and above",
        "Use a non-negative value",
      );
    }
  } else {
    throw new CompileError(
      "Invalid type suffix '" + suffix + "'",
      source,
      "Only the following type suffixes are supported: " +
        validTypes.join(", "),
      "Use one of the supported type suffixes or no suffix at all",
    );
  }
}

function parseNumericLiteral(
  str: string,
): { value: number; suffix: string } | undefined {
  let numStr = "";
  let i = 0;
  let isNegative = false;

  if (str[0] === "-") {
    isNegative = true;
    i = 1;
  }

  while (i < str.length && str[i] >= "0" && str[i] <= "9") {
    numStr += str[i];
    i++;
  }

  if (numStr.length === 0) {
    return undefined;
  }

  const num = parseInt(numStr);
  const suffix = str.slice(i);
  const value = isNegative ? -num : num;

  return { value, suffix };
}

function handleBinaryAddition(source: string): string | undefined {
  if (!source.includes(" + ")) {
    return undefined;
  }

  const parts = source.split(" + ");
  if (parts.length !== 2) {
    return undefined;
  }

  const left = parts[0];
  const right = parts[1];

  // Case 1: __args__[1].length + numeric literal
  if (left === "__args__[1].length") {
    const parsed = parseNumericLiteral(right);
    if (!parsed) {
      return undefined;
    }

    validateTypeRange(parsed.suffix, parsed.value, source);

    return (
      "#include <stdlib.h>\n#include <string.h>\nint main(int argc, char* argv[]) { if (argc < 2) return " +
      parsed.value +
      "; return strlen(argv[1]) + " +
      parsed.value +
      "; }"
    );
  }

  // Case 2: numeric literal + __args__[1].length
  if (right === "__args__[1].length") {
    const parsed = parseNumericLiteral(left);
    if (!parsed) {
      return undefined;
    }

    validateTypeRange(parsed.suffix, parsed.value, source);

    return (
      "#include <stdlib.h>\n#include <string.h>\nint main(int argc, char* argv[]) { if (argc < 2) return " +
      parsed.value +
      "; return " +
      parsed.value +
      " + strlen(argv[1]); }"
    );
  }

  return undefined;
}

function handleLetBinding(source: string): string | undefined {
  if (!source.startsWith("let ")) {
    return undefined;
  }

  const semicolonIndex = source.indexOf(";");
  if (semicolonIndex === -1) {
    return undefined;
  }

  const declaration = source.slice(4, semicolonIndex).trim();
  const returnExpression = source.slice(semicolonIndex + 1).trim();

  const colonIndex = declaration.indexOf(":");
  if (colonIndex === -1) {
    return undefined;
  }

  const varName = declaration.slice(0, colonIndex).trim();
  const typeAndValue = declaration.slice(colonIndex + 1).trim();

  const equalsIndex = typeAndValue.indexOf("=");
  if (equalsIndex === -1) {
    return undefined;
  }

  const type = typeAndValue.slice(0, equalsIndex).trim();
  const value = typeAndValue.slice(equalsIndex + 1).trim();

  // Validate the type
  const validTypes = [
    "U8",
    "U16",
    "U32",
    "U64",
    "I8",
    "I16",
    "I32",
    "I64",
    "USize",
  ];
  if (!validTypes.includes(type)) {
    return undefined;
  }

  // For now, we only support __args__[1].length as the RHS
  if (value !== "__args__[1].length") {
    return undefined;
  }

  // For now, we only support returning the variable name
  if (returnExpression !== varName) {
    return undefined;
  }

  // Generate C code that returns the length of argv[1]
  return "#include <stdlib.h>\n#include <string.h>\nint main(int argc, char* argv[]) { if (argc < 2) return 0; return strlen(argv[1]); }";
}

export function compileTuffToC(source: string): string {
  // Check for invalid keywords
  if (source === "undefined") {
    throw new CompileError(
      "Undefined value is not allowed",
      "undefined",
      "The value 'undefined' is not a valid expression in Tuff. Tuff requires explicit values.",
      "Remove the 'undefined' or replace it with a valid value",
    );
  }

  // Empty program - return valid C code that exits with code 0
  if (source === "") {
    return "#include <stdlib.h>\nint main() { return 0; }";
  }

  // Check for read<Type>() syntax
  if (source.startsWith("read<") && source.endsWith(">()")) {
    const typeStart = 5; // After "read<"
    const typeEnd = source.length - 3; // Before ">()
    const type = source.slice(typeStart, typeEnd);

    const validTypes = [
      "U8",
      "U16",
      "U32",
      "U64",
      "I8",
      "I16",
      "I32",
      "I64",
      "USize",
    ];
    if (!validTypes.includes(type)) {
      throw new CompileError(
        "Invalid type in read function",
        source,
        "Only the following types are supported: " + validTypes.join(", "),
        "Use one of the supported types",
      );
    }

    return "#include <stdlib.h>\nint main(int argc, char* argv[]) { if (argc < 2) return 1; return atoi(argv[1]); }";
  }

  // Check for __args__[1].length syntax
  if (source === "__args__[1].length") {
    return "#include <stdlib.h>\n#include <string.h>\nint main(int argc, char* argv[]) { if (argc < 2) return 0; return strlen(argv[1]); }";
  }

  // Check for binary operations
  const binaryResult = handleBinaryAddition(source);
  if (binaryResult) {
    return binaryResult;
  }

  // Check for let binding
  const letResult = handleLetBinding(source);
  if (letResult) {
    return letResult;
  }

  // Numeric literal (with optional type suffix) - return C code that exits with that numeric value
  const parsed = parseNumericLiteral(source);
  if (parsed) {
    validateTypeRange(parsed.suffix, parsed.value, source);
    return "#include <stdlib.h>\nint main() { return " + parsed.value + "; }";
  }

  throw new CompileError("Not implemented yet", source, "?", "?");
}
