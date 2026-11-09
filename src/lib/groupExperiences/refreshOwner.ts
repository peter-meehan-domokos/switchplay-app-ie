// A mounted Gallery owns its cursor, while the active Group owns its clock.
// Card previews are hydrated by the composed refresh and need no extra read.
export type GroupRefreshOwner = {
  refresh(): Promise<void>;
  onRefresh(listener: () => Promise<void>): () => void;
};
