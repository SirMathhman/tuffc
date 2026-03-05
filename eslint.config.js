import js from "@eslint/js";
import parser from "@typescript-eslint/parser";

export default [
  {
    files: ["**/*.ts", "**/*.js"],
    languageOptions: {
      parser: parser,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='RegExp']",
          message:
            "RegExp constructor is not allowed. Use string methods instead.",
        },
        {
          selector: "Literal[regex]",
          message:
            "Regex literals are not allowed. Use string methods instead.",
        },
        {
          selector: "Literal[value=null]",
          message: "null is not allowed. Use undefined instead.",
        },
        {
          selector: "ThrowStatement",
          message: "throw is not allowed. Use Result<T, E> type instead.",
        },
        {
          selector: "TSTypeLiteral",
          message:
            "Anonymous object types are not allowed. Use named interfaces instead.",
        },
      ],
    },
  },
];
