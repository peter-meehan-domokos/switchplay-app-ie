import { MeasurementError } from "./measureLayout";

function fontRequests(root: HTMLElement) {
  const requests = new Map<string, { font: string; text: string; family: string }>();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const text = walker.currentNode;
    const parent = text.parentElement;
    if (!parent || !text.textContent?.trim() || parent.closest(".katex-mathml, .pstrut, .vlist-s")) continue;
    const style = getComputedStyle(parent);
    const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const key = font;
    const existing = requests.get(key);
    if (existing) existing.text += text.textContent;
    else requests.set(key, { font, family: style.fontFamily, text: text.textContent });
  }
  return requests;
}

const familyNames = (family: string) => (family.match(/"[^"]*"|'[^']*'|[^,]+/g) ?? []).map(name => name.trim().replace(/^["']|["']$/g, ""));

// A document font event may belong to another instance or unrelated UI.
export function fontChangeAffects(root: HTMLElement, event: Event) {
  const requests = fontRequests(root);
  const faces = (event as FontFaceSetLoadEvent).fontfaces ?? [];
  if (faces.length) {
    const families = new Set([...requests.values()].flatMap(request => familyNames(request.family)));
    return faces.some(face => families.has(face.family.replace(/^["']|["']$/g, "")));
  }
  return [...requests.values()].some(({ font, text }) => !document.fonts.check(font, text));
}

export async function ensureFonts(root: HTMLElement, signal: AbortSignal) {
  if (!document.fonts) throw new MeasurementError("FONT_API_UNAVAILABLE", "Browser font readiness cannot be verified.");
  const requests = fontRequests(root);
  // A missing scoped engine stylesheet otherwise looks like a successful
  // system-font load. Demand its actual font declaration when maths is present.
  const math = root.querySelector<HTMLElement>(".katex");
  if (math && !getComputedStyle(math).fontFamily.includes("KaTeX")) throw new MeasurementError("MATH_STYLES_UNAVAILABLE", "KaTeX styles have not loaded.");
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  try {
    await Promise.race([
      (async () => {
        await Promise.all([...requests.values()].map(async ({ font, text, family }) => {
          const faces = await document.fonts.load(font, text);
          const names = familyNames(family);
          const declared = [...document.fonts].filter(face => names.includes(face.family.replace(/^["']|["']$/g, "")));
          // WebKit can resolve load() with [] for an already-failed declared
          // face while check() accepts the fallback. That is not font readiness.
          const failedFamily = names.some(name => { const matching = declared.filter(face => face.family.replace(/^["']|["']$/g, "") === name); return matching.length > 0 && matching.every(face => face.status === "error"); });
          if (failedFamily || (family.includes("KaTeX") && faces.length === 0) || faces.some(face => face.status !== "loaded") || !document.fonts.check(font, text)) {
            throw new MeasurementError("FONT_LOAD_FAILED", `Required font ${family} is unavailable.`);
          }
        }));
        // Do not wait for unrelated instances' fonts. load() verifies this
        // content's faces; the measurement lifecycle then checks stable layout.
      })(),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new MeasurementError("FONT_TIMEOUT", "Required font loading did not complete within 10 seconds.")), 10000); }),
      new Promise<never>((_, reject) => { abort = () => reject(new DOMException("Measurement cancelled", "AbortError")); signal.addEventListener("abort", abort, { once: true }); if (signal.aborted) abort(); }),
    ]);
  } catch (error) {
    if (error instanceof MeasurementError) throw error;
    throw new MeasurementError("FONT_LOAD_FAILED", "A required font failed to load.");
  } finally { clearTimeout(timeout); if (abort) signal.removeEventListener("abort", abort); }
}
