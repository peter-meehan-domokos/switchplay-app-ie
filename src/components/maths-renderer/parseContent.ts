import type { MathsDiagnostic, SourceRange } from "./types";

export type ContentPart =
  | { kind: "text"; text: string }
  | { kind: "math"; latex: string; raw: string; display: boolean; source: SourceRange; expressionStart: number }
  | { kind: "literal"; raw: string; source: SourceRange };
export type ContentBlock = { kind: "paragraph"; parts: ContentPart[] } | { kind: "display"; part: Extract<ContentPart, { kind: "math" }> };

const newline = (text: string) => text.replace(/\r\n?/g, "\n");
function escaped(source: string, index: number) {
  let count = 0;
  while (index > 0 && source[--index] === "\\") count++;
  return count % 2 === 1;
}

export function parseContent(source: string): { blocks: ContentBlock[]; diagnostics: MathsDiagnostic[] } {
  const tokens: ContentPart[] = [];
  const diagnostics: MathsDiagnostic[] = [];
  let start = 0, index = 0;
  function text(end: number) {
    if (end > start) {
      const raw = source.slice(start, end);
      // Remove only the backslash escaping a prose dollar, not other backslashes.
      let value = "";
      for (let i = 0; i < raw.length; i++) {
        if (raw[i] === "$" && escaped(raw, i)) value = value.slice(0, -1);
        value += raw[i];
      }
      tokens.push({ kind: "text", text: newline(value) });
    }
  }
  while (index < source.length) {
    if (source[index] !== "$" || escaped(source, index)) { index++; continue; }
    text(index);
    const display = source[index + 1] === "$";
    const delimiter = display ? "$$" : "$";
    const expressionStart = index + delimiter.length;
    let end = expressionStart;
    while (end < source.length && !(source.startsWith(delimiter, end) && !escaped(source, end))) end++;
    if (end >= source.length) {
      const range = { start: index, end: source.length };
      diagnostics.push({ code: "UNMATCHED_DELIMITER", severity: "error", source: range, message: `Unmatched ${delimiter} delimiter. The remaining source is displayed literally.` });
      tokens.push({ kind: "literal", raw: source.slice(index), source: range });
      start = source.length;
      break;
    }
    const stop = end + delimiter.length;
    tokens.push({ kind: "math", latex: source.slice(expressionStart, end), raw: source.slice(index, stop), display,
      source: { start: index, end: stop }, expressionStart });
    index = start = stop;
  }
  text(source.length);

  const blocks: ContentBlock[] = [];
  let parts: ContentPart[] = [];
  function flush() {
    if (parts.length) blocks.push({ kind: "paragraph", parts });
    parts = [];
  }
  tokens.forEach((token, position) => {
    if (token.kind === "math" && token.display) { flush(); blocks.push({ kind: "display", part: token }); return; }
    if (token.kind !== "text") { parts.push(token); return; }
    let value = token.text;
    // The single newline adjoining a display delimiter separates blocks; it
    // does not create an extra empty prose line. Interior prose breaks survive.
    const previous = tokens[position - 1], next = tokens[position + 1];
    if (previous?.kind === "math" && previous.display) value = value.replace(/^(?:[ \t]*\n)+/, "");
    if (next?.kind === "math" && next.display) value = value.replace(/(?:\n[ \t]*)+$/, "");
    const paragraphs = value.split(/\n[ \t]*\n(?:[ \t]*\n)*/);
    paragraphs.forEach((paragraph, i) => {
      if (i) flush();
      if (paragraph) parts.push({ kind: "text", text: paragraph });
    });
  });
  flush();
  return { blocks, diagnostics };
}
