// Transport assembly only. Accepted content remains owned by domain controllers.
export type PreparationAuthority = { viewerUserId: string; experienceId: string; structureRevision: number; accessEpoch: number; adoptionRevision: number };
export type PreparationPart = { index: number; value: unknown } | { index: number; text: string; offset: number; digest: string; last: boolean };
export type PreparationPage = PreparationAuthority & { paged: true; scope: string; parts: PreparationPart[]; next: string | null;
  selection?: import("./model").PerspectiveSelection };
export class PreparationAssembly {
  readonly values = new Map<number, unknown>();
  private fragment?: { index: number; digest: string; text: string };
  scope?: string;
  resetFragment() { this.fragment = undefined; }
  accept(page: PreparationPage) {
    if (this.scope && this.scope !== page.scope) throw Error("Group preparation scope changed. Retry.");
    this.scope = page.scope;
    for (const part of page.parts) {
      if ("value" in part) { this.values.set(part.index, part.value); continue; }
      if (!part.offset) this.fragment = { index: part.index, digest: part.digest, text: "" };
      const current = this.fragment;
      if (!current || current.index !== part.index || current.digest !== part.digest || current.text.length !== part.offset) throw Error("Incomplete Group preparation page. Retry.");
      current.text += part.text;
      if (part.last) { this.values.set(part.index, JSON.parse(current.text)); this.fragment = undefined; }
    }
    if (!page.next && this.fragment) throw Error("Incomplete Group preparation page. Retry.");
  }
}
