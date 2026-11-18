import { expect, test } from "@playwright/test";
import { build } from "esbuild";

test("darker active tabs retain four readable labels and unchanged keyboard geometry", async ({ page }) => {
  const result = await build({ stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
    import { useState } from "react"; import { createRoot } from "react-dom/client";
    import Tabs from "./src/components/decks/StepMediaTabs";
    const items = ["Watch", "Area", "Try", "Recall"].map((label, i) => ({ id: String(i), label, kind: "activity", activityId: "integration-area" }));
    function Fixture() { const [selected, select] = useState("0"); return <div style={{ width: 250 }}><Tabs items={items} selectedId={selected} panelId="panel" onSelect={select} /></div>; }
    createRoot(document.getElementById("root")).render(<Fixture />);
  ` }, bundle: true, write: false, outfile: "tabs.js", jsx: "automatic", define: { "process.env.NODE_ENV": '"test"' } });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.route("https://tabs.invalid/**", route => route.fulfill({ contentType: "text/html", body:
    `<style>body{margin:0}${result.outputFiles.find(f => f.path.endsWith(".css"))!.text}</style><div id="root"></div><script>${result.outputFiles.find(f => f.path.endsWith(".js"))!.text}</script>` }));
  await page.goto("https://tabs.invalid/");
  const tabs = page.getByRole("tab"); await expect(tabs).toHaveCount(4);
  await expect(tabs.first()).toHaveCSS("background-color", "rgb(166, 189, 195)");
  await expect(tabs.nth(1)).toHaveCSS("background-color", "rgb(245, 248, 247)");
  const before = await tabs.evaluateAll(nodes => nodes.map(e => {
    const r = e.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(e); const text = range.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, textLeft: text.left, textRight: text.right };
  }));
  for (const tab of before) { expect(tab.textLeft).toBeGreaterThanOrEqual(tab.x); expect(tab.textRight).toBeLessThanOrEqual(tab.x + tab.width); }
  await tabs.first().focus(); await page.keyboard.press("End"); await expect(tabs.last()).toBeFocused();
  await expect(tabs.last()).toHaveAttribute("aria-selected", "true");
  await expect(tabs.last()).toHaveCSS("background-color", "rgb(166, 189, 195)");
  await expect(tabs.first()).toHaveCSS("background-color", "rgb(245, 248, 247)");
  expect(await tabs.evaluateAll(nodes => nodes.map(e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })))
    .toEqual(before.map(({ x, y, width, height }) => ({ x, y, width, height })));
});
