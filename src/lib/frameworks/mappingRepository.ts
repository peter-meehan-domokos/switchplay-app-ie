import type { ClientSession } from "mongodb";
import type { CardRepository } from "../cards/repository";
import { assertFrameworkConfiguration, type Framework } from "./configuration";
import { canonicalParent, type CanonicalAncestry } from "./mapping";

// Server-internal structural reads. Do not expose this graph in public DTOs:
// ancestor content authorization and personal history are separate concerns.
export async function readCanonicalAncestry(repo: CardRepository, frameworks: readonly Framework[], cardTemplateIds: readonly string[] = [], session?: ClientSession): Promise<CanonicalAncestry> {
  assertFrameworkConfiguration(frameworks);
  if (!session) return repo.transaction((snapshot) => readCanonicalAncestry(repo, frameworks, cardTemplateIds, snapshot));
  let pending = [...new Set([...cardTemplateIds, ...frameworks.flatMap((framework) => framework.areas.flatMap((area) =>
    area.items.flatMap((item) => item.cardTemplateIds)))])];
  const graph = new Map<string, unknown>(), requested = new Set<string>();
  while (pending.length) {
    const next = new Set<string>();
    // Each identity is requested once, including missing identities and cycles.
    for (let offset = 0; offset < pending.length; offset += 100) {
      const batch = pending.slice(offset, offset + 100);
      batch.forEach((id) => requested.add(id));
      const roots = await repo.cards().find({ cardTemplateId: { $in: batch } }, {
        session, projection: { _id: 0, cardTemplateId: 1, forkedFrom: 1 },
      }).toArray();
      roots.forEach((root) => {
        graph.set(root.cardTemplateId, root);
        const parent = canonicalParent(root);
        if (parent) next.add(parent);
      });
    }
    pending = [...next].filter((id) => !requested.has(id));
  }
  return graph;
}
