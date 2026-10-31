import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";

const TS_FILES = ["**/*.{ts,tsx,mts,cts}"];

/** typescript-eslint's strictest presets, run with full type information on TypeScript files. */
const typeChecked = [
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
].map((config) => ({ ...config, files: TS_FILES }));

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
    ],
  },
  ...typeChecked,
  {
    files: TS_FILES,
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // House style: `type` aliases everywhere, `import type` for type-only imports.
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      // `onClick={() => setOpen(false)}` is idiomatic React; template literals may hold numbers.
      "@typescript-eslint/no-confusing-void-expression": ["error", { ignoreArrowShorthand: true }],
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    rules: {
      ...jsxA11y.flatConfigs.strict.rules,
      // Tab panels and scrollable regions take focus so keyboard users can reach and scroll
      // them (WAI-ARIA tabs pattern; axe `scrollable-region-focusable`).
      "jsx-a11y/no-noninteractive-tabindex": ["error", { roles: ["tabpanel", "region"] }],
    },
  },
  {
    // Browser and engine code must not pull Zod into the client bundle: take values from
    // the zod-free modules (constants, dates) and only types from the contracts barrel.
    files: [
      "src/components/**",
      "src/lib/engine/**",
      "src/lib/client/**",
      "src/three/**",
      "src/lib/presets.ts",
    ],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/contracts",
              message:
                "Import values from @/lib/contracts/constants or /dates; the barrel loads Zod.",
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
];

export default config;
