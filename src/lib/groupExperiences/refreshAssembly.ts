import type { GroupRefresh } from "./refresh";
import type { PreparationAssembly } from "./preparationPages";
export function assembledRefresh(assembly: PreparationAssembly): GroupRefresh {
  const head = assembly.values.get(0) as Omit<GroupRefresh, "contributions"> | undefined;
  if (!head?.cards) throw Error("Incomplete Group refresh. Retry.");
  const contributions: GroupRefresh["contributions"] = { media: {}, reflections: {} };
  for (const [i, card] of head.cards.entries()) {
    const row = assembly.values.get(i + 1) as { cardTemplateId: string; media: GroupRefresh["contributions"]["media"][string]; reflection: GroupRefresh["contributions"]["reflections"][string] } | undefined;
    if (row?.cardTemplateId !== card.cardTemplateId || !row.media || !row.reflection) throw Error("Incomplete Group refresh. Retry.");
    contributions.media[row.cardTemplateId] = row.media; contributions.reflections[row.cardTemplateId] = row.reflection;
  }
  return { ...head, contributions };
}
