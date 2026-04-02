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
