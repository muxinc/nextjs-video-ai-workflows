import antfu from "@antfu/eslint-config";
import nextPlugin from "@next/eslint-plugin-next";
import remotionPlugin from "@remotion/eslint-plugin";

const nextRecommended = nextPlugin.configs.recommended ?? { rules: {} };
const nextRecommendedRules = nextRecommended.rules ?? {};
const offNextRules = Object.fromEntries(
  Object.keys(nextRecommendedRules).map(k => [k, "off"]),
);

export default antfu({
  type: "app",
  typescript: true,
  formatters: true,
  react: true,
  ignores: [
    // Next.js specific ignores
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vercel Workflows auto-generated files
    "app/.well-known/**",
    // Drizzle migration meta files (auto-generated)
    "db/migrations/meta/**",
  ],
  stylistic: {
    indent: 2,
    semi: true,
    quotes: "double",
  },
}, {
  rules: {
    "no-console": ["warn"],
    "antfu/no-top-level-await": ["off"],
    "node/prefer-global/process": ["off"],
    "node/no-process-env": ["error"],
    "perfectionist/sort-imports": ["error", {
      tsconfigRootDir: ".",
      groups: [
        "side-effect-style",
        "builtin",
        "external",
        ["internal", "internal-type"],
        ["parent", "parent-type"],
        ["sibling", "sibling-type"],
        ["index", "index-type"],
        "type",
        "side-effect",
        "object",
        "unknown",
      ],
      internalPattern: ["^@mux/ai.*"],
    }],
    "unicorn/filename-case": ["error", {
      case: "kebabCase",
      ignore: ["README.md", "^[A-Z]+\\.md$", "^[A-Z][A-Z0-9-]+\\.md$"],
    }],
    // Cuddled else: } else { on same line
    "style/brace-style": ["error", "1tbs"],
    // Operators at end of line, not beginning
    "style/operator-linebreak": ["error", "after"],
  },
}, {
  // Next.js specific rules
  plugins: {
    "@next/next": nextPlugin,
  },
  rules: {
    ...nextPlugin.configs.recommended.rules,
    ...nextPlugin.configs["core-web-vitals"].rules,
  },
}, {
  // Remotion rules applied only to remotion files
  files: ["remotion/**"],
  ...remotionPlugin.flatPlugin,
  rules: {
    // Allow process.env in Remotion scripts (e.g., deploy.mjs)
    "node/no-process-env": ["off"],
    ...remotionPlugin.flatPlugin.rules,
  },
}, {
  // Disable all Next.js rules within remotion files
  files: ["remotion/**"],
  rules: {
    ...offNextRules,
  },
});
