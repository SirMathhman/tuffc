import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  collectCoverage: true,
  collectCoverageFrom: ["src/**/*.ts", "!src/cli.ts"],
  coverageThreshold: {
    global: {
      branches: 98,
      functions: 100,
      lines: 99,
      statements: 99,
    },
  },
};

export default config;
