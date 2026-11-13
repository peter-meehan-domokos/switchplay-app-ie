import { parseContent } from "../maths-renderer/parseContent";
import type { MathsDiagnostic } from "../maths-renderer/types";
import { infoMathsPresentation } from "./infoCardMaths";

// Info Card content formatting (checkpoint 9). This layer splits an Info Card body into the pieces the face
// renders, without changing the shared maths renderer or its parser:
//   [[centre]]...[[/centre]]      centres the enclosed content horizontally;
//   [[v-centre]]...[[/v-centre]]  centres the enclosed content vertically in the free body space;
//   two or more blank lines       are kept as an explicit spacer (the renderer would collapse them into one break).
// Each tag is an independent on/off flag, so combined tags mean the same thing in either nesting order.
// Tags inside maths are left to the maths. Unmatched or misspelt tags stay visible as text and are reported.
export type InfoContentItem = { kind: "content"; source: string; offset: number; centre: boolean };
export type InfoContentSpacer = { kind: "spacer"; blankLines: number; heightEm: number };
export type InfoContentBlock = { vCentre: boolean; items: readonly (InfoContentItem | InfoContentSpacer)[] };
export type InfoCardContentLayout = { blocks: readonly InfoContentBlock[]; diagnostics: readonly MathsDiagnostic[] };

type Kind = "centre" | "v-centre";
type Tag = { kind: Kind; open: boolean; start: number; end: number };
type Range = { start: number; end: number };
type Chunk = { start: number; end: number; centre: boolean; vCentre: boolean; afterTag: boolean };
type Piece = InfoContentItem & { vCentre: boolean; end: number; startsWithDisplay: boolean; endsWithDisplay: boolean };

const TAG = /\[\[(\/?)([A-Za-z][A-Za-z-]*)\]\]/g;
// Near-misses of the two supported names (American spelling, missing hyphen, capitals) are reported, not ignored.
const NEAR_MISS = /^(v-?)?cent(re|er)$/i;
const tagText = (kind: Kind, open: boolean) => `[[${open ? "" : "/"}${kind}]]`;

function tagsOf(body: string, protectedRanges: readonly Range[]) {
  const inside = (index: number) => protectedRanges.some(range => index >= range.start && index < range.end);
  const candidates: Tag[] = [], diagnostics: MathsDiagnostic[] = [];
  for (const match of body.matchAll(TAG)) {
    const start = match.index, end = start + match[0].length, name = match[2];
    if (inside(start)) continue;
    if (name === "centre" || name === "v-centre") candidates.push({ kind: name, open: !match[1], start, end });
    else if (NEAR_MISS.test(name)) diagnostics.push({ code: "INFO_UNKNOWN_FORMAT_TAG", severity: "error", source: { start, end },
      message: `${match[0]} is not a formatting tag. Use [[centre]]…[[/centre]] or [[v-centre]]…[[/v-centre]].` });
  }
  // Each kind is a single flag: an open needs a later close of the same kind, with no second open in between.
  const accepted: Tag[] = [], open = new Map<Kind, Tag>();
  for (const tag of candidates) {
    const current = open.get(tag.kind);
    if (tag.open && current) diagnostics.push({ code: "INFO_NESTED_FORMAT_TAG", severity: "error", source: { start: tag.start, end: tag.end },
      message: `${tagText(tag.kind, true)} is already open. Close it with ${tagText(tag.kind, false)} before opening it again.` });
    else if (tag.open) open.set(tag.kind, tag);
    else if (!current) diagnostics.push({ code: "INFO_UNMATCHED_FORMAT_TAG", severity: "error", source: { start: tag.start, end: tag.end },
      message: `${tagText(tag.kind, false)} has no matching ${tagText(tag.kind, true)} before it.` });
    else { accepted.push(current, tag); open.delete(tag.kind); }
  }
  for (const tag of open.values()) diagnostics.push({ code: "INFO_UNMATCHED_FORMAT_TAG", severity: "error", source: { start: tag.start, end: tag.end },
    message: `${tagText(tag.kind, true)} has no matching ${tagText(tag.kind, false)}.` });
  return { tags: accepted.toSorted((a, b) => a.start - b.start), diagnostics: diagnostics.toSorted((a, b) => a.source!.start - b.source!.start) };
}

// Runs of two or more blank lines outside maths: the places the renderer would collapse.
function blankRunsOf(body: string, protectedRanges: readonly Range[]) {
  return [...body.matchAll(/\n(?:[ \t]*\n){2,}/g)].map(match => ({ start: match.index, end: match.index + match[0].length }))
    .filter(run => !protectedRanges.some(range => run.start < range.end && run.end > range.start));
}

// Blank lines in the gap between two pieces of content. Tag text counts as a line's content, so a tag on its
// own line is not a blank line; the partial lines at either end belong to the neighbouring content.
function blankLines(body: string, tags: readonly Tag[], start: number, end: number, leading: boolean) {
  const gap = tags.reduce((text, tag) => tag.start >= start && tag.end <= end
    ? text.slice(0, tag.start - start) + "T".repeat(tag.end - tag.start) + text.slice(tag.end - start) : text, body.slice(start, end));
  const lines = gap.split("\n");
  return lines.slice(leading ? 0 : 1, -1).filter(line => !line.trim()).length;
}

export function buildInfoCardContentLayout(body: string, presentation: { paragraphGapEm: number; lineHeight: number } = infoMathsPresentation): InfoCardContentLayout {
  const parsed = parseContent(body);
  const parts = parsed.blocks.flatMap(block => block.kind === "display" ? [block.part] : block.parts);
  const protectedRanges = parts.flatMap(part => part.kind === "text" ? [] : [part.source]);
  const displays = parts.flatMap(part => part.kind === "math" && part.display ? [part.source] : []);
  const { tags, diagnostics } = tagsOf(body, protectedRanges);

  // Cut the body at accepted tags and at collapsed blank-line runs; each tag toggles its own flag.
  const cuts = [...tags.map(tag => ({ ...tag, tag: true as const })), ...blankRunsOf(body, protectedRanges).map(run => ({ ...run, tag: false as const }))]
    .toSorted((a, b) => a.start - b.start);
  const state = cuts.reduce(({ chunks, last, centre, vCentre, afterTag }, cut) => ({
    chunks: [...chunks, { start: last, end: cut.start, centre, vCentre, afterTag }],
    last: cut.end,
    centre: cut.tag && cut.kind === "centre" ? cut.open : centre,
    vCentre: cut.tag && cut.kind === "v-centre" ? cut.open : vCentre,
    afterTag: cut.tag,
  }), { chunks: [] as Chunk[], last: 0, centre: false, vCentre: false, afterTag: false });
  const allChunks: Chunk[] = [...state.chunks, { start: state.last, end: body.length, centre: state.centre, vCentre: state.vCentre, afterTag: state.afterTag }];

  // Trim the newlines that only separate a chunk from its neighbours; indentation of real lines is kept.
  const pieces = allChunks.flatMap((chunk): Piece[] => {
    const text = body.slice(chunk.start, chunk.end);
    const lead = (text.match(/^(?:[ \t]*\n)*/)![0].length);
    const indent = chunk.afterTag ? text.slice(lead).match(/^[ \t]*/)![0].length : 0;
    const start = chunk.start + lead + indent, end = chunk.start + text.trimEnd().length;
    if (end <= start) return [];
    return [{ kind: "content", source: body.slice(start, end), offset: start, centre: chunk.centre, vCentre: chunk.vCentre, end,
      startsWithDisplay: displays.some(range => range.start === start), endsWithDisplay: displays.some(range => range.end === end) }];
  });

  // Spacers reproduce what the blank lines would have looked like as one source: a paragraph break, plus one
  // line height for each further blank line. Next to display maths the renderer already spaces the block.
  const sequence = pieces.flatMap((piece, index): (Piece | (InfoContentSpacer & { vCentre: boolean }))[] => {
    const previous = pieces[index - 1];
    const count = blankLines(body, tags, previous ? previous.end : 0, piece.offset, !previous);
    if (!count) return [piece];
    const base = !previous || previous.endsWithDisplay || piece.startsWithDisplay ? 0 : presentation.paragraphGapEm;
    const heightEm = base + (previous ? count - 1 : count) * presentation.lineHeight;
    return heightEm > 0 ? [{ kind: "spacer", blankLines: count, heightEm, vCentre: !!previous?.vCentre && piece.vCentre }, piece] : [piece];
  });

  // Consecutive pieces sharing the vertical flag form one block, so a vertically centred group stays together.
  const blocks = sequence.reduce<InfoContentBlock[]>((list, entry) => {
    const item: InfoContentItem | InfoContentSpacer = entry.kind === "spacer"
      ? { kind: "spacer", blankLines: entry.blankLines, heightEm: entry.heightEm }
      : { kind: "content", source: entry.source, offset: entry.offset, centre: entry.centre };
    const previous = list.at(-1);
    return previous && previous.vCentre === entry.vCentre ? [...list.slice(0, -1), { ...previous, items: [...previous.items, item] }]
      : [...list, { vCentre: entry.vCentre, items: [item] }];
  }, []);
  return { blocks, diagnostics };
}

export const infoContentItems = (layout: InfoCardContentLayout) =>
  layout.blocks.flatMap(block => block.items.flatMap(item => item.kind === "content" ? [item] : []));
