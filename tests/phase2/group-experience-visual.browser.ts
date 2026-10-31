import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import { geometry } from "./helpers/presentationGeometry";

const fixture = JSON.parse(process.env.PHASE2_GROUP_FIXTURE ?? "null") as { experienceId: string; cardIds: string[] } | null;
test.skip(!fixture, "Requires the disposable --group-experiences fixture");
const neutral = "rgb(174, 181, 193)";

async function open(page: Page, width: number) {
  await page.setViewportSize({ width, height: 844 });
  await page.request.post("/api/auth/login", { data: { identifier: "phase2", password: "local-test-only" } });
  const current = await (await page.request.get(`/api/group-experiences/${fixture!.experienceId}`)).json();
  await page.request.patch(`/api/group-experiences/${fixture!.experienceId}/navigation`, { data: {
    accessEpoch: current.accessEpoch, expectedStructureRevision: current.structureRevision,
    selection: { perspective: "group" }, activeCardId: fixture!.cardIds[0],
  } });
  await page.goto(`/decks?openExperience=${fixture!.experienceId}`);
  await expect(page.locator(".group-picker-current")).toBeEnabled();
}

async function inspectRows(page: Page, surface: string, editable: boolean) {
  await geometry(page, [surface]);
  const rows = await page.locator(`${surface} .group-step-learning`).evaluateAll(elements => elements.map(element => {
    const bar = element.querySelector<HTMLElement>(".step-progress-strip")!;
    const text = element.querySelector<HTMLElement>(".group-step-counts");
    const button = element.querySelector<HTMLButtonElement>(".step-progress-hit-area");
    const b = bar.getBoundingClientRect(), scale = b.width / 24;
    const t = text?.getBoundingClientRect(), hit = button?.getBoundingClientRect();
    const description = element.closest(".step-copy")!.querySelector(".step-description")!.getBoundingClientRect();
    const at = (x: number, y: number) => document.elementFromPoint(x, y);
    return {
      gap: t ? (t.left - b.right) / scale : null,
      centred: t ? Math.abs(b.y + b.height / 2 - t.y - t.height / 2) / scale : null,
      colour: text ? getComputedStyle(text).color : null,
      size: text ? getComputedStyle(text).fontSize : null,
      weight: text ? getComputedStyle(text).fontWeight : null,
      hitWidth: hit ? hit.width / scale : null, hitHeight: hit ? hit.height / scale : null,
      hits: hit && button ? [.1, .5, .9].flatMap(x => [.1, .5, .9].map(y => button.contains(at(hit.left + hit.width * x, hit.y + hit.height * y)))) : [],
      textHit: t ? !!at(t.left + t.width / 2, t.y + t.height / 2)?.closest(".step-progress-hit-area") : false,
      descriptionHit: !!at(description.left + description.width / 2, description.y + description.height / 2)?.closest(".step-progress-hit-area"),
      contained: hit ? hit.top >= description.bottom - .5 && hit.right <= (t?.left ?? Infinity) : true,
    };
  }));
  expect(rows).toHaveLength(3);
  for (const row of rows) {
    expect(row.gap).toBeCloseTo(6, 1); expect(row.centred).toBeLessThan(.5);
    expect(row.colour).toBe(neutral); expect(row.size).toBe("8px"); expect(row.weight).toBe("400");
    expect(row.textHit).toBe(false); expect(row.descriptionHit).toBe(false); expect(row.contained).toBe(true);
    if (editable) {
      expect(row.hitWidth).toBeCloseTo(52, 1); expect(row.hitHeight).toBeCloseTo(24, 1);
      expect(row.hits).toEqual(Array(9).fill(true));
    } else expect(row.hitWidth).toBeNull();
  }
}

for (const width of [320, 390, 1440]) {
  test(`Group progress measures from the visible bar and keeps independent touch targets at ${width}`, async ({ page }) => {
    await open(page, width);
    for (const face of ["front", "back"]) {
      const score = page.locator(`.deck-card.is-active .deck-card-surface--${face} .card-confidence`);
      await expect(score).toHaveCSS("color", neutral); await expect(score).toHaveCSS("font-weight", "500");
      await expect(score).toHaveCSS("font-size", "12.8px");
      await expect(score.locator("sup")).toHaveText(["G", "F"]);
    }
    await inspectRows(page, ".deck-card.is-active .deck-card-surface--front", false);
    await page.locator(".deck-card.is-active").focus(); await page.locator(".deck-card.is-active").press("Enter");
    await inspectRows(page, ".focused-card-surface--front", true);
    const target = page.locator(".focused-card-surface--front .step-progress-hit-area").first();
    const initial = await target.getAttribute("aria-label");
    const box = (await target.boundingBox())!;
    // Real pointer input in the invisible left portion must still reach the
    // existing progress control, not the surrounding Step detail gesture.
    const saved = page.waitForResponse(response => response.url().endsWith("/group-learning") && response.request().method() === "PATCH");
    await page.mouse.click(box.x + box.width * .1, box.y + box.height / 2);
    expect((await saved).status()).toBe(200);
    await expect(target).not.toHaveAttribute("aria-label", initial!);
    await expect(page.locator(".step-view-layer")).toHaveCount(0);
    await page.locator(".group-picker-current").click(); await page.getByRole("button", { name: "All followers", exact: true }).click();
    await expect(page.locator(".group-comparison-panel")).toBeVisible();
    await inspectRows(page, ".focused-card-surface--front", true);
    await page.locator(".group-identity-card").filter({ hasText: "Alice" }).click();
    await expect(page.locator(".focused-card-surface--front .step-progress-hit-area")).toHaveCount(0);
    // Return to Group to inspect its read-only follower-count row on the back.
    await page.locator(".group-identity-card").first().click();
    const header = (await geometry(page, [".focused-card-surface--front .card-title-anchor"]))[".focused-card-surface--front .card-title-anchor"];
    await page.mouse.move(header[0] + header[2] / 2, header[1] + header[3] / 2); await page.mouse.down();
    await page.mouse.move(header[0] + header[2] / 2 + 180, header[1] + header[3] / 2, { steps: 12 }); await page.mouse.up();
    await expect(page.locator(".group-experience")).toHaveAttribute("data-face", "back");
    await expect(page.locator(".focused-card-surface--back .card-semantic-anchors .group-confidence-pair")).toHaveCount(1);
    await expect(page.locator(".focused-card-surface--back .group-back-heading .group-confidence-pair")).toHaveCount(0);
    await expect(page.locator(".focused-card-surface--back .focused-card-signal-trace")).toHaveCount(3);
    await expect(page.locator(".focused-card-surface--back .group-step-counts").first()).toHaveCSS("color", neutral);
  });
}

test("read-only focused Group rows retain alignment and count taps never cycle progress", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.request.post("/api/auth/login", { data: { identifier: "other", password: "local-test-only" } });
  const current = await (await page.request.get(`/api/group-experiences/${fixture!.experienceId}`)).json();
  await page.request.patch(`/api/group-experiences/${fixture!.experienceId}/navigation`, { data: {
    accessEpoch: current.accessEpoch, expectedStructureRevision: current.structureRevision,
    selection: { perspective: "group" }, activeCardId: fixture!.cardIds[0],
  } });
  await page.goto(`/decks?openExperience=${fixture!.experienceId}`);
  await expect(page.locator(".group-picker-current")).toBeEnabled();
  await page.locator(".deck-card.is-active").focus(); await page.locator(".deck-card.is-active").press("Enter");
  await inspectRows(page, ".focused-card-surface--front", false);
  let learningWrites = 0;
  page.on("request", request => { if (request.method() === "PATCH" && request.url().includes("-learning")) learningWrites++; });
  await page.locator(".focused-card-surface--front .group-step-counts").first().click();
  // The surrounding Step detail owns this tap; it is never a progress action.
  await expect(page.locator(".step-view-layer")).toBeVisible();
  expect(learningWrites).toBe(0);
});

test("Card 2 Bob preserves main progress geometry in ordinary, focused and comparison views", async ({ page }) => {
  await open(page, 390);
  const current = await (await page.request.get(`/api/group-experiences/${fixture!.experienceId}`)).json();
  await page.request.patch(`/api/group-experiences/${fixture!.experienceId}/navigation`, { data: {
    accessEpoch: current.accessEpoch, expectedStructureRevision: current.structureRevision, activeCardId: fixture!.cardIds[1],
  } });
  await page.reload(); await expect(page.locator(".deck-card.is-active")).toContainText("Control the movement");
  await page.locator(".group-picker-current").click(); await page.getByRole("button", { name: "All followers", exact: true }).click();
  await page.locator(".group-perspective-list button").filter({ hasText: "Bob" }).click();
  await expect(page.locator(".group-picker-current")).toHaveText(/Bob/);
  const inspect = async (surface: string, focused: boolean) => {
    await geometry(page, [surface]);
    const rows = await page.locator(`${surface} .active-step-item`).evaluateAll(elements => elements.map(element => {
      const description = element.querySelector(".step-description")!.getBoundingClientRect(), bar = element.querySelector(".step-progress-strip")!.getBoundingClientRect();
      const step = element.getBoundingClientRect(), scale = bar.width / 24;
      return { top: step.top / scale, height: step.height / scale, descriptionHeight: description.height / scale, gap: (bar.top-description.bottom)/scale };
    }));
    for (let i = 0; i < 3; i++) {
      const copyGap = i === 1 ? 4.5 : 4;
      expect(rows[i].gap).toBeCloseTo(copyGap + (focused ? 6.5 : 0), 1);
      expect(rows[i].height).toBeCloseTo(Math.max(37, rows[i].descriptionHeight + copyGap + (focused ? 19 : 3)), 1);
      if (i > 0) expect(rows[i].top - rows[i-1].top - rows[i-1].height).toBeCloseTo(i === 1 ? 17 : 15.5, 1);
    }
    await expect(page.locator(`${surface} .step-progress-hit-area`)).toHaveCount(0);
    await expect(page.locator(`${surface} .group-step-counts`)).toHaveCount(0);
  };
  await inspect(".deck-card.is-active .deck-card-surface--front", false);
  await page.locator(".deck-card.is-active").focus(); await page.locator(".deck-card.is-active").press("Enter");
  await inspect(".focused-card-surface--front", true);
  await page.locator(".group-picker-current").click(); await page.getByRole("button", { name: "All followers", exact: true }).click();
  await expect(page.locator(".group-comparison-panel")).toBeVisible();
  await inspect(".focused-card-surface--front", true);
});

test("shared personal confidence keeps its size and neutral weight on both faces, with or without assessments", async ({ page }) => {
  await open(page, 390);
  const styles = await page.evaluate(() => Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style')).map(node => node.outerHTML).join(""));
  // Mount the real shared anchor in isolation to exercise both prop paths;
  // no application feature, synthetic assessment state or database writes.
  const bundle = await build({ stdin: { contents: `
    import React from "react";
    import { createRoot } from "react-dom/client";
    import Anchors from "./src/components/decks/CardSemanticAnchors";
    const card = { id: "personal", label: "Card 1", signals: [{ rawReading: 6 }], progressPercentage: 0 };
    createRoot(document.getElementById("fixture")).render(<>
      {["front", "back"].flatMap(variant => [false, true].map(assessment =>
        <div key={variant + assessment} data-case={variant + assessment} style={{ position: "relative", width: 252, height: 80 }}>
          <Anchors card={card} dateLabel="" variant={variant} assessment={assessment ? <span>Existing indicator</span> : undefined} />
        </div>))}
    </>);
  `, resolveDir: process.cwd(), loader: "tsx" }, bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", tsconfig: "tsconfig.json",
    define: { "process.env.NODE_ENV": '"development"' } });
  await page.route("**/__confidence-fixture", route => route.fulfill({ contentType: "text/html", body: `<html><head>${styles}</head><body><div id="fixture"></div></body></html>` }));
  await page.goto("/__confidence-fixture"); await page.addScriptTag({ content: bundle.outputFiles[0].text });
  for (const variant of ["front", "back"]) for (const assessment of [false, true]) {
    const score = page.locator(`[data-case="${variant}${assessment}"] .card-confidence`);
    await expect(score).toHaveCSS("color", neutral); await expect(score).toHaveCSS("font-weight", "500");
    await expect(score).toHaveCSS("font-size", variant === "back" && assessment ? "10.24px" : "12.8px"); await expect(score).toHaveText("6");
  }
});
