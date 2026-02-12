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

  // Numeric literal (with optional type suffix) - return C code that exits with that numeric value
  let numStr = "";
  let i = 0;
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
      return `#include <stdlib.h>\nint main() { return ${num}; }`;
    }
  }

  throw new CompileError("Not implemented yet", source, "?", "?");
}
