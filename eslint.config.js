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
    },
  },
];
