// Runs on src/ only — enforces no-unused-vars so exports only used in tests are flagged
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
  },
};
