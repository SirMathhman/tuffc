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
      {
        selector: "TSTypeLiteral",
        message:
          "Use named interfaces or types instead of anonymous object type literals",
      },
      {
        selector: "TSTypeReference[typeName.name='Record']",
        message: "Use Map<K, V> instead of Record",
      },
    ],
  },
};
