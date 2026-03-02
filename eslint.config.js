import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["node_modules", "dist", "coverage"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[regex]",
          message: "Regular expressions are not allowed",
        },
        {
          selector: "ThrowStatement",
          message:
            "Throw statements are not allowed. Use Result<T, E> instead.",
        },
        {
          selector:
            "TSTypeReference > TSTypeLiteral, TSTypeAliasDeclaration > TSUnionType > TSTypeLiteral",
          message:
            "Anonymous object types are not allowed. Use named interfaces instead.",
        },
        {
          selector: "ForStatement",
          message:
            "for loops are not allowed. Use while, map, reduce, or other alternatives.",
        },
      ],
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
    },
  },
];
