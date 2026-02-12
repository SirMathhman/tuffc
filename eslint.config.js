import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  {
    ignores: ["node_modules", "dist", ".bun"],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        console: "readonly",
        process: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "ThrowStatement",
          message:
            "Use Result<T, E> instead of throwing errors. Use err() to create a Failure result.",
        },
        {
          selector: "Literal[regex]",
          message:
            "Regular expressions are not allowed. Use string methods instead.",
        },
        {
          selector: "NewExpression[callee.name='RegExp']",
          message:
            "RegExp constructor is not allowed. Use string methods instead.",
        },
        {
          selector: "Literal[value=null]",
          message: "Do not use null. Use undefined instead.",
        },
      ],
      "max-lines-per-function": [
        "error",
        {
          max: 100,
          skipBlankLines: true,
          skipComments: true,
        },
      ],
    },
  },
];
