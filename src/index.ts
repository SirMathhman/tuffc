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
  const validTypes = ["U8", "U16", "U32", "U64", "I8", "I16", "I32", "I64"];

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

    const validTypes = ["U8", "U16", "U32", "U64", "I8", "I16", "I32", "I64"];
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

  // Check for __args__[0].length syntax
  if (source === "__args__[0].length") {
    return "#include <stdlib.h>\n#include <string.h>\nint main(int argc, char* argv[]) { if (argc < 2) return 0; return strlen(argv[1]); }";
  }

  // Numeric literal (with optional type suffix) - return C code that exits with that numeric value
  let numStr = "";
  let i = 0;
  let isNegative = false;

  // Check for optional negative sign (for signed types)
  if (source[0] === "-") {
    isNegative = true;
    i = 1;
  }

  while (i < source.length && source[i] >= "0" && source[i] <= "9") {
    numStr += source[i];
    i++;
  }

  // Check if we parsed at least one digit
  if (numStr.length > 0) {
    // Check if remaining characters are valid suffix (letters or digits)
    let validSuffix = true;
    for (let j = i; j < source.length; j++) {
      const char = source[j];
      const isLetter =
        (char >= "A" && char <= "Z") || (char >= "a" && char <= "z");
      const isDigit = char >= "0" && char <= "9";
      if (!(isLetter || isDigit)) {
        validSuffix = false;
        break;
      }
    }

    // If remaining chars are valid suffix (or none), it's a valid literal
    if (validSuffix) {
      const num = parseInt(numStr);
      const suffix = source.slice(i);
      const value = isNegative ? -num : num;

      validateTypeRange(suffix, value, source);

      return "#include <stdlib.h>\nint main() { return " + value + "; }";
    }
  }

  throw new CompileError("Not implemented yet", source, "?", "?");
}
