export default [
  {
    files: ["src/main/js/**/*.js", "src/test/js/**/*.js"],
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
            "Do not use 'throw' in JS compiler code. Return Result<T, E> values instead.",
        },
      ],
    },
  },
];
