import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  {
    files: ["**/*.{ts,js,mjs,cjs}"],
    languageOptions: {
      parser: tsParser,
      sourceType: "module",
    },
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSTypeLiteral",
          message: "Prefer named interfaces.",
        },
        {
          selector: "TSTypeReference Identifier[name='Record']",
          message: "Prefer Map instead of Record.",
        },
        {
          selector: "Literal[regex]",
          message: "Do not use regex syntax; parse manually.",
        },
        {
          selector: "NewExpression[callee.name='RegExp']",
          message: "Do not construct regexes; parse manually.",
        },
        {
          selector: "CallExpression[callee.name='RegExp']",
          message: "Do not construct regexes; parse manually.",
        },
      ],
    },
  },
];
