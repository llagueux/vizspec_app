import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { globalIgnores } from "eslint/config";

const baseDirectory = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  globalIgnores([".github/**", ".next/**", "next-env.d.ts", "node_modules/**", "coverage/**"]),
];

export default config;
