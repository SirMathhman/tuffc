import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "TemplateLiteral",
          message: "Template literals are not allowed.",
        },
        {
          selector: "Literal[regex]",
          message: "Regex literals are not allowed.",
        },
        {
          selector: "NewExpression[callee.name='RegExp']",
          message: "new RegExp() is not allowed.",
        },
        {
          selector: "TSTypeLiteral",
          message:
            "Inline type literals are not allowed. Use a named interface instead.",
        },
        {
          selector: "Literal[value=null]",
          message: "null is not allowed. Use undefined instead.",
        },
        {
          selector: "TSNullKeyword",
          message: "null type is not allowed. Use undefined instead.",
        },
        {
          selector: "ThrowStatement",
          message: "throw is not allowed. Use Result<T, E> instead.",
        },
      ],
    },
  },
);
