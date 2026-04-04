import js from "@eslint/js";

export default [
  {
    ignores: ["node_modules/**", "coverage/**", "bun.lock", "bun.lockb"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      sourceType: "module",
      ecmaVersion: "latest",
      globals: {
        console: "readonly",
      },
    },
    rules: {
      "no-console": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[regex]",
          message: "Regex literals are not allowed.",
        },
        {
          selector: "NewExpression[callee.name='RegExp']",
          message: "Use of new RegExp(...) is not allowed.",
        },
        {
          selector: "CallExpression[callee.name='RegExp']",
          message: "Use of RegExp(...) is not allowed.",
        },
      ],
    },
  },
];
