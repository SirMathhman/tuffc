export default [
  {
    files: ["src/main/js/**/*.ts", "src/test/js/**/*.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ThrowStatement",
          message:
            "Do not use 'throw' in compiler code. Return Result<T, E> values instead.",
        },
      ],
    },
  },
];
