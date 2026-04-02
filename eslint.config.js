import js from "@eslint/js";

export default [
  {
    ignores: ["node_modules/**", "bun.lockb"],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
      },
    },
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[regex]",
          message:
            "Regex literals are not allowed. Use non-regex logic instead.",
        },
        {
          selector: "NewExpression[callee.name='RegExp']",
          message:
            "Do not construct regular expressions with the RegExp constructor.",
        },
        {
          selector: "CallExpression[callee.name='RegExp']",
          message:
            "Do not construct regular expressions with the RegExp constructor.",
        },
      ],
      ...js.configs.recommended.rules,
    },
  },
  {
    files: ["test/**/*.js"],
    languageOptions: {
      globals: {
        expect: "readonly",
        test: "readonly",
      },
    },
  },
];
