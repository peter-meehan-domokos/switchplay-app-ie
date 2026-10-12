import type { Plugin } from "esbuild";
import { resolve } from "node:path";
import type { Framework } from "../../src/lib/frameworks/configurationContracts";

// Replace the whole catalogue binding, keeping real contracts/validation/access.
// This is a bundler-only fixture seam: no runtime overrides or source-text edits.
export function frameworkCataloguePlugin(frameworks: readonly Framework[]): Plugin {
  const contracts = JSON.stringify(resolve(process.cwd(), "src/lib/frameworks/configurationContracts.ts"));
  return { name: "framework-catalogue-fixture", setup(builder) {
    builder.onLoad({ filter: /src\/lib\/frameworks\/configuration\.ts$/ }, () => ({ loader: "ts", contents: `
      export * from ${contracts};
      import { createFrameworkAccess } from ${contracts};
      export const { getFrameworks, getFramework, getFrameworkItem } = createFrameworkAccess(${JSON.stringify(frameworks)});
    ` }));
  } };
}
