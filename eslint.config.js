import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    files: ["src/**/*.ts", "tests/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs["recommended"].rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[regex]",
          message: "Regex literals are banned in the bootstrap compiler.",
        },
        {
          selector: "NewExpression[callee.name='RegExp']",
          message: "RegExp construction is banned in the bootstrap compiler.",
        },
        {
          selector: "TSTypeReference > Identifier[name='Record']",
          message:
            "Record is banned in the bootstrap compiler. Use Map instead.",
        },
        {
          selector: "TSTypeLiteral",
          message:
            "Type literals are banned in the bootstrap compiler. Use named interfaces instead.",
        },
        {
          selector: "Literal[value=null]",
          message:
            "null is banned in the bootstrap compiler. Use undefined instead.",
        },
        {
          selector: "TSNullKeyword",
          message: "null is banned in type annotations. Use undefined instead.",
        },
        {
          selector: "ThrowStatement",
          message:
            "throw statements are banned in the bootstrap compiler. Use Result<T, X> instead.",
        },
      ],
    },
  },
];
