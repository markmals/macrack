import { defineConfig } from "vite-plus";

export default defineConfig({
    fmt: {
        ignorePatterns: [".agents/**", "assets/**", "exports/**", "**/*.md"],
        printWidth: 100,
        tabWidth: 4,
        proseWrap: "never",
        arrowParens: "avoid",
        sortPackageJson: true,
        sortImports: {
            groups: [
                "type-import",
                ["value-builtin", "value-external"],
                "type-internal",
                "value-internal",
                ["type-parent", "type-sibling", "type-index"],
                ["value-parent", "value-sibling", "value-index"],
                "unknown",
            ],
            partitionByComment: true,
        },
    },
    lint: {
        ignorePatterns: [".agents/**", "assets/**", "exports/**", "**/node_modules/**"],
        options: {
            typeAware: true,
            typeCheck: true,
        },
        jsPlugins: ["eslint-plugin-perfectionist", "eslint-plugin-prefer-let"],
        rules: {
            "typescript/no-floating-promises": "allow",
            "eslint/prefer-const": "off",
            "prefer-let/prefer-let": [2, { forceUpperCaseConst: true }],
        },
    },
    test: {
        include: ["tests/**/*.test.ts"],
        // OCCT booleans and full-rack mesh intersections take seconds, not milliseconds.
        testTimeout: 180_000,
        hookTimeout: 180_000,
    },
});
