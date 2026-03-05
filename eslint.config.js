import js from "@eslint/js";
import parser from "@typescript-eslint/parser";
import tseslint from "@typescript-eslint/eslint-plugin";

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
      ],
    },
  },
];
