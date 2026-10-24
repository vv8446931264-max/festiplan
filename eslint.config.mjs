import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [".next/**", "node_modules/**", "coverage/**", "playwright-report/**", "test-results/**", "next-env.d.ts"],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // Browser and engine code must not pull Zod into the client bundle: take values from
    // the zod-free modules (constants, dates) and only types from the contracts barrel.
    files: ["src/components/**", "src/lib/engine/**", "src/lib/client/**", "src/three/**", "src/lib/presets.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/contracts",
              message: "Import values from @/lib/contracts/constants or /dates; the barrel loads Zod.",
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
];

export default config;
