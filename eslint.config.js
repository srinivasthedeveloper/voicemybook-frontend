import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist", "node_modules", "build", "*.config.js"]),

  {
    files: ["**/*.{ts,tsx}"],

    extends: [
      js.configs.recommended,

      // TypeScript rules
      ...tseslint.configs.recommended,

      // Enable type-aware linting (important)
      ...tseslint.configs.recommendedTypeChecked,

      // React rules
      react.configs.flat.recommended,

      // Hooks
      reactHooks.configs.flat.recommended,

      // Vite fast refresh safety
      reactRefresh.configs.vite,
    ],

    languageOptions: {
      parser: tseslint.parser,

      ecmaVersion: "latest",
      sourceType: "module",

      parserOptions: {
        project: "./tsconfig.eslint.json", // enables type-aware linting
      },

      globals: globals.browser,
    },

    settings: {
      react: {
        version: "detect",
      },
    },

    rules: {
      // 🔧 Useful tweaks
      "react/react-in-jsx-scope": "off", // not needed in React 17+
      "react/prop-types": "off", // using TS instead

      // TS tweaks
      "@typescript-eslint/no-unused-vars": ["warn"],
      "@typescript-eslint/consistent-type-imports": "warn",

      // React Refresh
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-unsafe-enum-comparison": "warn",
      "@typescript-eslint/no-unsafe-function-type": "warn",
      "@typescript-eslint/restrict-template-expressions": "warn",
    },
  },
]);
