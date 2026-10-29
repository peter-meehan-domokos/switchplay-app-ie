export default {
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core"],
  outputFileTracingIncludes: {
    "/api/proof": ["./node_modules/@sparticuz/chromium/bin/**", "./node_modules/playwright-core/**", "./public/fonts/Liberation*.ttf"]
  },
  poweredByHeader: false,
};
