import { expect, test, type Page } from "@playwright/test";

const streamUrl = "**/downloads/default.mp4*";
const appVideoUrl = "**/api/media/card/video-file*";
const iphoneSafari = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

async function openPreparedVideo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /^Open video 2 of 8:/ }).click();
  const viewer = page.getByRole("dialog", { name: "Card media viewer" });
  await viewer.getByRole("button", { name: "Download encoded MP4" }).click();
  return viewer;
}

test("desktop keeps the existing automatic anchor and ready link", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => {
    (window as Window & { __desktopDownloads?: Array<{ url: string; filename: string; target: string }> }).__desktopDownloads = [];
    HTMLAnchorElement.prototype.click = function () {
      (window as Window & { __desktopDownloads?: Array<{ url: string; filename: string; target: string }> }).__desktopDownloads!.push({
        url: this.href, filename: this.download, target: this.target,
      });
    };
  });
  const viewer = await openPreparedVideo(page);
  await expect.poll(() => page.evaluate(() => (window as Window & { __desktopDownloads?: unknown[] }).__desktopDownloads?.length)).toBe(1);
  const automatic = await page.evaluate(() => (window as Window & { __desktopDownloads?: Array<{ url: string; filename: string; target: string }> }).__desktopDownloads![0]);
  expect(automatic).toMatchObject({ filename: "Practice.mp4", target: "_blank" });
  expect(automatic.url).toContain("/downloads/default.mp4");
  await expect(viewer.getByRole("link", { name: "Download ready" })).toBeVisible();
  await expect(viewer.getByRole("link", { name: "Download ready" })).toHaveAttribute("download", "Practice.mp4");
  await expect(viewer).toBeVisible();
});

test.describe("iPhone Safari simulation", () => {
  test.use({ userAgent: iphoneSafari });

  async function mockShare(page: Page, mode: "resolve" | "cancel" | "deny" = "resolve") {
    await page.addInitScript((shareMode) => {
      const testWindow = window as Window & {
        __activationActive?: boolean;
        __iosShareCalls?: Array<{ filename: string; mimeType: string; title: string }>;
        __newTabs?: Array<{ url: string; target: string }>;
        __autoLinks?: string[];
      };
      testWindow.__activationActive = true;
      testWindow.__iosShareCalls = [];
      testWindow.__newTabs = [];
      testWindow.__autoLinks = [];
      HTMLAnchorElement.prototype.click = function () { testWindow.__autoLinks!.push(this.href); };
      Object.defineProperty(navigator, "userActivation", { configurable: true, value: { get isActive() { return testWindow.__activationActive; } } });
      Object.defineProperty(navigator, "canShare", { configurable: true, value: ({ files }: ShareData) => files?.length === 1 });
      Object.defineProperty(navigator, "share", { configurable: true, value: async ({ files, title }: ShareData) => {
        testWindow.__iosShareCalls!.push({ filename: files![0].name, mimeType: files![0].type, title: title ?? "" });
        if (shareMode === "cancel") throw new DOMException("Cancelled", "AbortError");
        if (shareMode === "deny") throw new DOMException("Not allowed", "NotAllowedError");
      } });
      Object.defineProperty(window, "open", { configurable: true, value: (url: string, target: string) => {
        testWindow.__newTabs!.push({ url, target });
        return null;
      } });
    }, mode);
  }

  const shareCalls = (page: Page) => page.evaluate(() => (window as Window & { __iosShareCalls?: unknown[] }).__iosShareCalls ?? []);

  test("small MP4 opens file sharing without replacing the viewer page", async ({ page }) => {
    await mockShare(page);
    await page.route(appVideoUrl, (route) => route.fulfill({ status: 200, headers: {
      "content-type": "video/mp4", "content-length": "4",
    }, body: Buffer.from([0, 0, 0, 0]) }));
    const viewer = await openPreparedVideo(page);
    await expect(viewer.getByRole("button", { name: "Save video" })).toBeVisible();
    expect(await shareCalls(page)).toHaveLength(0);
    expect(await page.evaluate(() => (window as Window & { __autoLinks?: string[] }).__autoLinks)).toEqual([]);
    await viewer.getByRole("button", { name: "Save video" }).click();
    await expect.poll(() => shareCalls(page)).toEqual([{ filename: "Practice.mp4", mimeType: "video/mp4", title: "Practice.mp4" }]);
    await expect(viewer).toBeVisible();
    expect(page.url()).toBe("http://127.0.0.1:4178/");
    await expect(viewer.getByText(/Check Photos or Files/)).toBeVisible();
  });

  test("repeated share denial becomes a retryable failure", async ({ page }) => {
    await mockShare(page, "deny");
    await page.route(appVideoUrl, (route) => route.fulfill({ status: 200, headers: { "content-type": "video/mp4" }, body: Buffer.from([1]) }));
    const viewer = await openPreparedVideo(page);
    await viewer.getByRole("button", { name: "Save video" }).click();
    await expect(viewer.getByRole("button", { name: "Open share sheet" })).toBeVisible();
    await viewer.getByRole("button", { name: "Open share sheet" }).click();
    await expect(viewer.getByRole("button", { name: "Retry save" })).toBeVisible();
    await expect(viewer.getByText("Safari could not share the video. Please retry.")).toBeVisible();
    await expect(viewer).toBeVisible();
  });

  test("share cancellation returns to ready without reporting a save", async ({ page }) => {
    await mockShare(page, "cancel");
    await page.route(appVideoUrl, (route) => route.fulfill({ status: 200, headers: { "content-type": "video/mp4" }, body: Buffer.from([1]) }));
    const viewer = await openPreparedVideo(page);
    await viewer.getByRole("button", { name: "Save video" }).click();
    await expect(viewer.getByText("Sharing cancelled. The video is still ready.")).toBeVisible();
    await expect(viewer.getByRole("button", { name: "Save video" })).toBeEnabled();
    await expect(viewer).toBeVisible();
    expect(page.url()).toBe("http://127.0.0.1:4178/");
  });

  test("failed fetch offers retry and a second direct gesture if activation expires", async ({ page }) => {
    await mockShare(page);
    let attempts = 0;
    await page.route(appVideoUrl, (route) => {
      attempts += 1;
      if (attempts === 1) return route.abort();
      return route.fulfill({ status: 200, headers: { "content-type": "video/mp4" }, body: Buffer.from([1, 2]) });
    });
    const viewer = await openPreparedVideo(page);
    await viewer.getByRole("button", { name: "Save video" }).click();
    await expect(viewer.getByRole("alert")).toBeVisible();
    await expect(viewer.getByRole("button", { name: "Retry save" })).toBeVisible();
    await page.evaluate(() => { (window as Window & { __activationActive?: boolean }).__activationActive = false; });
    await viewer.getByRole("button", { name: "Retry save" }).click();
    await expect(viewer.getByRole("button", { name: "Open share sheet" })).toBeVisible();
    await page.evaluate(() => { (window as Window & { __activationActive?: boolean }).__activationActive = true; });
    await viewer.getByRole("button", { name: "Open share sheet" }).click();
    await expect.poll(() => shareCalls(page)).toHaveLength(1);
    await expect(viewer).toBeVisible();
  });

  test("Safari uses app delivery without fetching the Cloudflare URL", async ({ page }) => {
    await mockShare(page);
    let directFetches = 0;
    await page.route(streamUrl, (route) => { directFetches += 1; return route.abort(); });
    await page.route(appVideoUrl, (route) => route.fulfill({ status: 200, headers: {
      "content-type": "video/mp4", "content-length": "3",
    }, body: Buffer.from([1, 2, 3]) }));
    const viewer = await openPreparedVideo(page);
    await viewer.getByRole("button", { name: "Save video" }).click();
    await expect.poll(() => shareCalls(page)).toEqual([{ filename: "Practice.mp4", mimeType: "video/mp4", title: "Practice.mp4" }]);
    expect(directFetches).toBe(0);
    await expect(viewer).toBeVisible();
    expect(page.url()).toBe("http://127.0.0.1:4178/");
  });

  test("large MP4 offers a new-tab fallback and leaves the viewer page intact", async ({ page }) => {
    await mockShare(page);
    await page.route(appVideoUrl, (route) => route.fulfill({ status: 200, headers: {
      "content-type": "video/mp4", "content-length": String(33 * 1024 * 1024),
    }, body: Buffer.from([1]) }));
    const viewer = await openPreparedVideo(page);
    await viewer.getByRole("button", { name: "Save video" }).click();
    await expect(viewer.getByText(/too large to share/)).toBeVisible();
    await expect(viewer.getByText(/Files → Downloads/)).toBeVisible();
    await viewer.getByRole("button", { name: "Download in new tab" }).click();
    await viewer.getByRole("button", { name: "Download in new tab" }).click();
    expect(await page.evaluate(() => (window as Window & { __newTabs?: unknown[] }).__newTabs?.length)).toBe(1);
    expect(await page.evaluate(() => (window as Window & { __newTabs?: Array<{ target: string }> }).__newTabs?.[0]?.target)).toBe("_blank");
    expect(await page.evaluate(() => (window as Window & { __newTabs?: Array<{ url: string }> }).__newTabs?.[0]?.url)).toContain("/api/media/card/video-file?");
    await expect(viewer).toBeVisible();
    expect(page.url()).toBe("http://127.0.0.1:4178/");
  });

  test("unavailable file sharing offers a fallback without fetching the MP4", async ({ page }) => {
    await mockShare(page);
    let fetches = 0;
    await page.route(appVideoUrl, (route) => { fetches += 1; return route.abort(); });
    const viewer = await openPreparedVideo(page);
    await page.evaluate(() => { Object.defineProperty(navigator, "canShare", { configurable: true, value: undefined }); });
    await viewer.getByRole("button", { name: "Save video" }).click();
    await expect(viewer.getByText(/File sharing is unavailable/)).toBeVisible();
    expect(fetches).toBe(0);
    await viewer.getByRole("button", { name: "Download in new tab" }).click();
    expect(await page.evaluate(() => (window as Window & { __newTabs?: Array<{ target: string }> }).__newTabs?.[0]?.target)).toBe("_blank");
    expect(await page.evaluate(() => (window as Window & { __newTabs?: Array<{ url: string }> }).__newTabs?.[0]?.url)).toContain("/api/media/card/video-file?");
    await expect(viewer).toBeVisible();
  });

  test("repeated taps start one file fetch and navigation ignores its late response", async ({ page }) => {
    await mockShare(page);
    let fetches = 0;
    await page.route(appVideoUrl, async (route) => {
      fetches += 1;
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.fulfill({ status: 200, headers: { "content-type": "video/mp4" }, body: Buffer.from([1]) }).catch(() => {});
    });
    const viewer = await openPreparedVideo(page);
    const save = viewer.getByRole("button", { name: "Save video" });
    await save.dblclick();
    await expect(viewer.getByRole("button", { name: "Loading video…" })).toBeDisabled();
    await viewer.getByRole("button", { name: "Next media" }).click();
    await expect(viewer.getByText("3 of 8")).toBeVisible();
    await page.waitForTimeout(500);
    expect(fetches).toBe(1);
    expect(await shareCalls(page)).toHaveLength(0);
    await expect(viewer).toBeVisible();
  });

  test("preparing MP4 stays in the viewer until Cloudflare reports ready", async ({ page }) => {
    await mockShare(page);
    let checks = 0;
    await page.route("**/api/media/card*", (route) => {
      const request = route.request();
      if (request.method() === "POST") return route.fulfill({ json: { status: "preparing", progress: 20 } });
      if (new URL(request.url()).searchParams.get("action") === "download") {
        checks += 1;
        return route.fulfill({ json: checks === 1 ? { status: "preparing", progress: 70 } : {
          status: "ready", url: "https://customer-test.cloudflarestream.com/stream-1/downloads/default.mp4", filename: "Practice.mp4",
        } });
      }
      return route.continue();
    });
    const viewer = await openPreparedVideo(page);
    await expect(viewer.getByText(/Preparing download/)).toBeVisible();
    await expect(viewer.getByRole("button", { name: "Save video" })).toBeVisible({ timeout: 12_000 });
    expect(checks).toBe(2);
    await expect(viewer).toBeVisible();
  });
});
