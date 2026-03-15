import tseslint from "typescript-eslint";
import localPlugin from "./eslint-local-rules";

export default tseslint.config(
  {
    ignores: [
      "coverage/**",
      "dist/**",
      "eslint.config.ts",
      "eslint-local-rules.ts",
    ],
  },
  {
    files: ["**/*.ts"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      local: localPlugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.eslint.json",
      },
    },
    rules: {
      "local/ban-array-push": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[regex]",
          message: "Regular expressions are not allowed",
        },
        {
          selector: "ThrowStatement",
          message: "Use Result<T, E> instead of throw statements",
        },
        {
          selector: "TSTypeLiteral",
          message:
            "Use named interfaces or types instead of anonymous object type literals",
        },
        {
          selector: "TSTypeReference[typeName.name='Record']",
          message: "Use Map<K, V> instead of Record",
        },
        {
          selector: "TemplateLiteral",
          message:
            "Template literals are not allowed; use string concatenation instead",
        },
      ],
    },
  },
  {
    // src/ only — flag exports that are only referenced in tests
    files: ["src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { args: "none", ignoreRestSiblings: true },
      ],
    },
  },
);
