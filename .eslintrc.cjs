module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.eslint.json",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "error",
      { args: "none", ignoreRestSiblings: true },
    ],
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
    ],
  },
  overrides: [
    {
      files: ["tests/**"],
      rules: {
        "@typescript-eslint/no-unused-vars": "off",
      },
    },
  ],
};
