// Flat config (ESLint v9) — Expo's recommended rules. This is the FIRST lint setup
// for mobile/, introduced alongside a CI gate, so it's baselined to gate on real
// errors going forward without a big up-front refactor: a few newer/opinionated
// rules are downgraded to warnings (triage later), and test-infra false positives
// are scoped off. Warnings don't fail CI; errors do.
const expoConfig = require("eslint-config-expo/flat");

module.exports = [
  ...expoConfig,
  { ignores: ["dist/*", ".expo/*", "node_modules/*", "coverage/*", "*.config.js"] },

  {
    // Opinionated react-hooks rules the existing hooks use intentionally — surfaced
    // as warnings, not CI-blocking errors, pending a triage pass.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },

  {
    // jest.setup.js is a CommonJS Node file (jest.mock + require).
    files: ["jest.setup.js"],
    languageOptions: {
      globals: { jest: "readonly", require: "readonly", module: "readonly", __dirname: "readonly" },
    },
    rules: { "no-undef": "off", "@typescript-eslint/no-require-imports": "off" },
  },

  {
    // Tests: jest.mock() is intentionally hoisted above imports; requires are fine.
    files: ["**/__tests__/**", "**/*.test.{ts,tsx}"],
    rules: { "import/first": "off", "@typescript-eslint/no-require-imports": "off" },
  },
];
