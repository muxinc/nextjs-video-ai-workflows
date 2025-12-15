import antfu from "@antfu/eslint-config";
import nextPlugin from "@next/eslint-plugin-next";
import remotionPlugin from "@remotion/eslint-plugin";

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
      ignore: ["README.md", "^[A-Z]+\\.md$"],
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
  // Remotion specific rules
  files: ["remotion/**/*.{ts,tsx}"],
  plugins: {
    "@remotion": remotionPlugin,
  },
  rules: {
    ...remotionPlugin.configs.recommended.rules,
  },
});
