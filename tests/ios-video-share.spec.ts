import { expect, test } from "@playwright/test";
import { fetchShareableVideoFile, isIphoneOrIpadSafari, isShareCancellation } from "@/lib/iosVideoShare";

const browser = (userAgent: string, platform = "iPhone", maxTouchPoints = 5) => ({ userAgent, platform, maxTouchPoints });

test("iPhone and desktop-mode iPad Safari use the file-share path while macOS Chrome keeps its download path", () => {
  expect(isIphoneOrIpadSafari(browser("Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/17 Mobile Safari/604.1"))).toBe(true);
  expect(isIphoneOrIpadSafari(browser("Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/17 Safari/605.1", "MacIntel", 5))).toBe(true);
  expect(isIphoneOrIpadSafari(browser("Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/17 Safari/605.1", "MacIntel", 0))).toBe(false);
  expect(isIphoneOrIpadSafari(browser("Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/130 Safari/537.36", "MacIntel", 0))).toBe(false);
  expect(isIphoneOrIpadSafari(browser("Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 CriOS/130 Mobile Safari/604.1"))).toBe(false);
});

test("a small MP4 becomes a named File and an advertised large file is not materialised", async () => {
  const signal = new AbortController().signal;
  const file = await fetchShareableVideoFile("https://stream.example/video.mp4", "Practice.mp4", signal,
    async () => new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "video/mp4", "Content-Length": "3" } }));
  expect(file).toBeInstanceOf(File);
  expect(file?.name).toBe("Practice.mp4");
  expect(file?.type).toBe("video/mp4");
  expect(file?.size).toBe(3);
  const large = await fetchShareableVideoFile("https://stream.example/video.mp4", "Practice.mp4", signal,
    async () => new Response(new Uint8Array([1]), { headers: { "Content-Length": String(33 * 1024 * 1024) } }));
  expect(large).toBeNull();
  expect(isShareCancellation(new DOMException("Cancelled", "AbortError"))).toBe(true);
  expect(isShareCancellation(new Error("Network failed"))).toBe(false);
});

test("a stream with no length stops once it exceeds the mobile memory cap", async () => {
  const chunk = new Uint8Array(17 * 1024 * 1024);
  const result = await fetchShareableVideoFile("https://stream.example/video.mp4", "Practice.mp4", new AbortController().signal,
    async () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(chunk); controller.enqueue(chunk); controller.close(); },
    })));
  expect(result).toBeNull();
});
