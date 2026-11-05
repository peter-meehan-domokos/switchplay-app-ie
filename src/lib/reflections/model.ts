// Storage ownership and the displayed context remain separate. A Group-origin
// reflection always belongs to its author, including when that author is an Admin.
export type ReflectionSource = { kind: "personal"; cardTemplateId: string }
  | { kind: "group"; cardTemplateId: string; experienceId: string; reflectionId: string | null };
export type ReflectionContext = { kind: "personal"; cardTemplateId: string; viewerUserId: string }
  | { kind: "group"; cardTemplateId: string; experienceId: string; viewerUserId: string };
export type ReflectionEntry = {
  source: ReflectionSource;
  authorUserId: string;
  authorName: string;
  text: string;
  revision: number;
  createdAt: string | null;
  originName: string;
  groupVisible: boolean;
};
export type ReflectionDisplayItem = {
  entry: ReflectionEntry;
  empty: boolean;
  label: string | null;
  private: boolean;
};
// Slot identity survives clearing/re-authoring and never depends on text,
// current carousel position, mutable usernames or a newly allocated row ID.
export function reflectionSlotKey(entry: Pick<ReflectionEntry, "source" | "authorUserId">) {
  const source = entry.source;
  return JSON.stringify([source.kind, entry.authorUserId, source.cardTemplateId,
    source.kind === "group" ? source.experienceId : null]);
}

export type ReflectionOperation = { operationId: string; actorUserId: string; commandHash: string };
export type GroupReflection = {
  reflectionId: string;
  experienceId: string;
  cardTemplateId: string;
  authorUserId: string;
  text: string;
  groupVisible: boolean;
  deleted: boolean;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  lastOperation: ReflectionOperation;
};

// Collective ownership is a distinct source, never a fabricated personal author.
export type CollectiveReflectionSource = { kind: "group-card"; experienceId: string; cardTemplateId: string };
export type CollectiveReflection = { source: CollectiveReflectionSource; text: string; revision: number; canEdit: boolean };
