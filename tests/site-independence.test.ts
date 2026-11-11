import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { test } from "node:test";
import { RESERVED_APP_SEGMENTS, STEP_VISUALS_SEGMENT } from "../src/lib/sites/siteRouting";
import { SITE_IDS, type SiteId } from "../src/lib/sites/siteResolver";

const root = resolve(__dirname, "..");
const appDir = join(root, "src", "app");

// Infrastructure the independent websites may share; everything else must be the site's own code.
const SHARED_ALIASES = ["@/lib/mongodb", "@/lib/auth", "@/lib/phoneCountries"];

const siteDirs = (site: SiteId) => [
  join(appDir, "sites", site),
  join(appDir, "api", "public", site),
];

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

const isWithin = (path: string, dirs: string[]) => dirs.some((dir) => path === dir || path.startsWith(dir + sep));

function importSpecifiers(source: string): string[] {
  const patterns = [/(?:^|\n)\s*import\s[^"';]*?from\s*["']([^"']+)["']/g, /(?:^|\n)\s*import\s*["']([^"']+)["']/g, /(?:^|\n)\s*export\s[^"';]*?from\s*["']([^"']+)["']/g, /import\(\s*["']([^"']+)["']\s*\)/g];
  return patterns.flatMap((pattern) => [...source.matchAll(pattern)].map((match) => match[1]));
}

test("every website exists with the expected pages", () => {
  for (const site of SITE_IDS) {
    for (const file of ["layout.tsx", "page.tsx", "siteInfo.ts", "contact/page.tsx", "privacy/page.tsx"]) {
      assert.ok(existsSync(join(appDir, "sites", site, file)), `${site}/${file}`);
    }
  }
});

test("src/app has no top-level route that the proxy could swallow or mis-route", () => {
  const known = new Set<string>([...RESERVED_APP_SEGMENTS, STEP_VISUALS_SEGMENT, "sites"]);
  const folders = readdirSync(appDir).filter((name) => statSync(join(appDir, name)).isDirectory());
  const unregistered = folders.filter((name) => !known.has(name) && !name.startsWith("_"));
  assert.deepEqual(unregistered, [], "Register new top-level app routes in RESERVED_APP_SEGMENTS (src/lib/sites/siteRouting.ts)");
});

test("websites import only their own code and the approved shared infrastructure", () => {
  const violations: string[] = [];
  for (const site of SITE_IDS) {
    const own = siteDirs(site);
    for (const dir of own) {
      for (const file of listFiles(dir).filter((path) => /\.(ts|tsx)$/.test(path))) {
        for (const specifier of importSpecifiers(readFileSync(file, "utf8"))) {
          let allowed: boolean;
          if (specifier.startsWith(".")) {
            allowed = isWithin(resolve(dirname(file), specifier), own);
          } else if (specifier.startsWith("@/")) {
            const target = join(root, "src", specifier.slice(2));
            allowed = isWithin(target, own) || SHARED_ALIASES.includes(specifier);
          } else {
            allowed = true;
          }
          if (!allowed) violations.push(`${relative(root, file)} imports ${specifier}`);
        }
      }
    }
  }
  assert.deepEqual(violations, []);
});

test("websites contain no other website's name or domain", () => {
  const violations: string[] = [];
  for (const site of SITE_IDS) {
    const others = SITE_IDS.filter((other) => other !== site);
    const dirs = [...siteDirs(site), join(root, "public", "images", "sites", site)];
    for (const file of dirs.flatMap(listFiles).filter((path) => /\.(ts|tsx|css)$/.test(path))) {
      const source = readFileSync(file, "utf8").toLowerCase();
      for (const other of others) {
        if (source.includes(other)) violations.push(`${relative(root, file)} mentions ${other}`);
      }
    }
  }
  assert.deepEqual(violations, []);
});

test("website styling stays in CSS modules", () => {
  const violations: string[] = [];
  for (const site of SITE_IDS) {
    for (const file of siteDirs(site).flatMap(listFiles)) {
      if (/\.(ts|tsx)$/.test(file)) {
        for (const specifier of importSpecifiers(readFileSync(file, "utf8"))) {
          if (specifier.endsWith(".css") && !specifier.endsWith(".module.css")) violations.push(`${relative(root, file)} imports global CSS ${specifier}`);
        }
      }
      if (file.endsWith(".css")) {
        if (!file.endsWith(".module.css")) violations.push(`${relative(root, file)} is not a CSS module`);
        readFileSync(file, "utf8").split("\n").forEach((line, index) => {
          if (/^\s*:global/.test(line)) violations.push(`${relative(root, file)}:${index + 1} has an unscoped :global rule`);
        });
      }
    }
  }
  assert.deepEqual(violations, []);
});

test("each website writes to its own, correctly named collections", () => {
  const expected = { contact: "ContactSupportSubmissions", "early-access": "EarlyAccessSignups", "creator-interest": "CreatorInterestSubmissions" } as const;
  const legacy = ["creatorInterestSubmissions", "earlyAccessSignups", "contactSupportSubmissions"];
  // Puckle's early-access URL now receives tuition enquiries, which have their own collection so historical
  // early-access signups (and their unique indexes) are left untouched.
  const suffixFor = (site: string, route: string, suffix: string) =>
    site === "puckle" && route === "early-access" ? "TuitionEnquiries" : suffix;
  for (const site of SITE_IDS) {
    for (const [route, defaultSuffix] of Object.entries(expected)) {
      const suffix = suffixFor(site, route, defaultSuffix);
      const source = readFileSync(join(appDir, "api", "public", site, route, "route.ts"), "utf8");
      assert.ok(source.includes(`"${site}${suffix}"`), `${site}/${route} should use ${site}${suffix}`);
      for (const name of legacy) assert.ok(!source.includes(`"${name}"`), `${site}/${route} must not use legacy collection ${name}`);
    }
  }
});

test("each website's forms post to that website's own endpoints", () => {
  for (const site of SITE_IDS) {
    const components = join(appDir, "sites", site, "components");
    const endpoints = listFiles(components).flatMap((file) => [...readFileSync(file, "utf8").matchAll(/fetch\("(\/api\/[^"]+)"/g)].map((match) => match[1]));
    assert.deepEqual(endpoints.toSorted(), [`/api/public/${site}/contact`, `/api/public/${site}/creator-interest`, `/api/public/${site}/early-access`]);
  }
});

test("only Puckle's header links to Step Visuals and each header shows the site's own brand", () => {
  for (const site of SITE_IDS) {
    const header = readFileSync(join(appDir, "sites", site, "components", "PublicHeader.tsx"), "utf8");
    assert.equal(header.includes('"/step-visuals"'), site === "puckle", site);
  }
});
