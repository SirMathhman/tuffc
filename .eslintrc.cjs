// Runs on src/ + tests/ — all rules EXCEPT no-unused-vars
module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.eslint.json",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  rules: {
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
};
