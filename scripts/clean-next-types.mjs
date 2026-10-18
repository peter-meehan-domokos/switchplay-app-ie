import { rmSync } from "node:fs";

// Both outputs are included by tsconfig. Regenerate current routes with next typegen.
for (const directory of [".next/types", ".next/dev/types"]) {
  rmSync(new URL(`../${directory}`, import.meta.url), { recursive: true, force: true });
}
