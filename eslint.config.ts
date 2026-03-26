import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "refactor.js"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts", "tests/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.bun,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/typedef": ["error", { variableDeclaration: true }],
      "no-template-curly-in-string": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "TemplateLiteral",
          message:
            "Template literals are banned. Use string concatenation instead.",
        },
        {
          selector: "TSTypeLiteral",
          message: "Type literals are banned. Use interfaces instead.",
        },
      ],
    },
  },
);
