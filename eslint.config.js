export default [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[regex]",
          message: "Regex literals are not allowed.",
        },
        {
          selector: "NewExpression[callee.name='RegExp']",
          message: "RegExp constructor is not allowed.",
        },
        {
          selector: "CallExpression[callee.name='RegExp']",
          message: "RegExp calls are not allowed.",
        },
      ],
    },
  },
  {
    ignores: ["node_modules/**", ".git/**", "bun.lock"],
  },
];
