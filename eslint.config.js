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
          selector: "WhileStatement",
          message: "While loops are not allowed. Use recursion instead.",
        },
        {
          selector: "ForStatement",
          message:
            "For statements are not allowed. Use recursion or reduce instead.",
        },
        {
          selector: "ForOfStatement",
          message:
            "For-of statements are not allowed. Use recursion or reduce instead.",
        },
        {
          selector: "ForInStatement",
          message:
            "For-in statements are not allowed. Use recursion or reduce instead.",
        },
        {
          selector: "IfStatement[alternate]",
          message:
            "Else statements are not allowed. Use separate if statements instead.",
        },
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
        {
          selector: "NewExpression[callee.name='Set']",
          message: "Set is not allowed. Use arrays instead.",
        },
        {
          selector: "CallExpression[callee.name='Set']",
          message: "Set is not allowed. Use arrays instead.",
        },
        {
          selector: "NewExpression[callee.name='Map']",
          message: "Map is not allowed. Use arrays instead.",
        },
        {
          selector: "CallExpression[callee.name='Map']",
          message: "Map is not allowed. Use arrays instead.",
        },
      ],
    },
  },
  {
    ignores: ["node_modules/**", ".git/**", "bun.lock"],
  },
];
