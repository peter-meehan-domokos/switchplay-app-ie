// Arial advances measured in Chromium on the approved development Mac at 1000px,
// rounded UP. No runtime browser or platform font dependency. See capacity tests.
const regular = [278,278,355,557,557,890,667,191,334,334,390,584,278,334,278,278,557,557,557,557,557,557,557,557,557,557,278,278,584,584,584,557,1016,667,667,723,723,667,611,778,723,278,500,667,557,834,723,778,667,778,723,667,611,723,667,944,667,667,611,278,278,278,470,557,334,557,557,500,557,557,278,557,557,223,223,500,223,834,557,557,557,557,334,500,278,557,500,723,500,500,500,334,260,334,584];
const bold = [278,334,475,557,557,890,723,238,334,334,390,584,278,334,278,278,557,557,557,557,557,557,557,557,557,557,334,334,584,584,584,611,976,723,723,723,723,667,611,778,723,278,557,723,611,834,723,778,667,778,723,667,611,723,667,944,667,667,611,334,278,334,584,557,334,557,611,557,611,557,334,611,611,278,278,557,278,890,611,611,611,611,390,557,334,611,557,778,557,557,500,390,280,390,584];
export const INFO_CAPACITY = { width: 240, height: 157, innerWidth: 214, headerWidth: 186,
  bodyFont: 9.5, seriesFont: 8.8, lineHeight: 11.875, paragraphGap: 7,
  // The series button makes the actual header ~11.984px tall. Reserve 12.125px
  // rather than assuming the body's 11.875px line box; round conservatively.
  headerHeight: 12.125, headerGap: 9, mediaHeight: 36, innerHeight: 131, version: 1 } as const;

export function textWidth(text: string, size = 9.5, weight: "regular" | "bold" = "regular") {
  const table = weight === "bold" ? bold : regular;
  return [...text].reduce((sum, ch) => {
    const code = ch.codePointAt(0)!;
    // Unknown glyphs use two ems, conservatively accounting for fallback fonts.
    // Accents/shaping are not assumed to have zero width.
    return sum + (table[code - 32] ?? (ch === "·" ? 334 : 2000)) * size / 1000;
  }, 0);
}

function lineCount(text: string): number {
  let lines = 0;
  for (const explicit of text.split("\n")) {
    let used = 0; lines++;
    // Wrap at spaces first, then anywhere for a word wider than the card, as CSS.
    for (const token of explicit.match(/ +|[^ ]+/gu) ?? []) {
      const width = textWidth(token);
      if (width <= INFO_CAPACITY.innerWidth) {
        if (used && used + width > INFO_CAPACITY.innerWidth) { lines++; used = 0; }
        used += width;
      } else for (const ch of token) {
        const w = textWidth(ch);
        if (used && used + w > INFO_CAPACITY.innerWidth) { lines++; used = 0; }
        used += w;
      }
    }
  }
  return lines;
}

export type InfoCapacityFieldIssue = {
  field: "title" | "body";
  code: "HEADER_OVERFLOW" | "BODY_OVERFLOW";
  message: string;
};

export function measureInfoCapacity(input: { title: string; body: string; seriesTitle: string; hasMedia: boolean }) {
  const { title, body, seriesTitle, hasMedia } = input;
  const paragraphs = body.split(/\n\s*\n/);
  const lines = paragraphs.reduce((total, paragraph) => total + lineCount(paragraph), 0);
  const headerWidth = textWidth(seriesTitle, 8.8) + textWidth(" · ") + textWidth(title, 9.5, "bold");
  const bodyHeight = lines * INFO_CAPACITY.lineHeight + (paragraphs.length - 1) * INFO_CAPACITY.paragraphGap;
  const availableBodyHeight = INFO_CAPACITY.innerHeight - INFO_CAPACITY.headerHeight - INFO_CAPACITY.headerGap - (hasMedia ? INFO_CAPACITY.mediaHeight : 0);
  const issues: string[] = [];
  if (!title.trim() || !body.trim() || !seriesTitle.trim()) issues.push("Title, series and explanatory text are required.");
  if (/[\r\n\t]/u.test(title + seriesTitle) || /[\p{Cc}\p{Cf}]/u.test((title + body + seriesTitle).replace(/\n/g, ""))) issues.push("Remove unsupported control characters (paragraph breaks are supported).");
  // Field diagnostics are renderer-independent output. Editors consume these
  // rather than reproducing geometry or assuming a line height. The measured
  // plain-text renderer remains the v1 capacity implementation.
  const fieldIssues: InfoCapacityFieldIssue[] = [];
  if (headerWidth > INFO_CAPACITY.headerWidth) fieldIssues.push({ field: "title", code: "HEADER_OVERFLOW",
    message: "The series name and title are too wide to fit together. Shorten either one." });
  if (bodyHeight > availableBodyHeight) fieldIssues.push({ field: "body", code: "BODY_OVERFLOW",
    message: "The explanation is too long to fit on the card. Shorten it or reduce paragraph breaks." });
  issues.push(...fieldIssues.map(issue => issue.message));
  return { fits: issues.length === 0, issues, fieldIssues, headerWidth, bodyHeight, availableBodyHeight, lines, metricVersion: INFO_CAPACITY.version };
}
