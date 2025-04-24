import antfu from "@antfu/eslint-config";

export default antfu({
  stylistic: {
    overrides: {
      "style/semi": "off",
      "style/quotes": "off",
      "eol-last": "never",
    },
  },
  jsonc: {
    overrides: {
      "jsonc/sort-keys": "off",
    },
  },
  typescript: {
    overrides: {
      "ts/ban-ts-comment": "off",
      "ts/prefer-ts-expect-error": "off",
    },
  },
});
