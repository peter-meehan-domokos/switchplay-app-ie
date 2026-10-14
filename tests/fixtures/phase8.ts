import { readFile } from "node:fs/promises";
import { BSON, ObjectId, type Document } from "mongodb";
import { BACKUP_COUNTS, ORIGINAL_COLLECTIONS, type OriginalSources } from "../../scripts/migration/phase8";

export async function phase8Fixture() {
  const fixture = JSON.parse(await readFile("tests/fixtures/first-class-migration.json", "utf8"));
  const owner = new ObjectId();
  const users = Array.from({ length: 11 }, (_, index) => ({ ...fixture.users[0], _id: index === 0 ? owner : new ObjectId(),
    username: `fixture-${index}`, decksData: index === 0 ? fixture.users[0].decksData : [] }));
  const decks = Array.from({ length: 41 }, (_, index) => {
    const deck = JSON.parse(JSON.stringify(fixture.deckTemplates[index % 2]));
    deck._id = new ObjectId(); deck.deckTemplateId = `deck-${index + 1}`; deck.template.deckTemplateId = deck.deckTemplateId;
    deck.ownerUserId = owner.toHexString(); delete deck.savedTemplate; return deck;
  });
  const sources = { deckTemplates: decks, users } as OriginalSources;
  for (const name of ORIGINAL_COLLECTIONS.slice(2)) sources[name] = Array.from({ length: BACKUP_COUNTS[name] }, (_, i) => ({ _id: new ObjectId(), fixture: i, createdAt: new Date("2026-10-01") }));
  const cloned = BSON.deserialize(BSON.serialize({ sources })).sources as OriginalSources;
  return { sources: cloned, files: { "fixture.bson": "fixture-only" }, indexes: Object.fromEntries(ORIGINAL_COLLECTIONS.map((name) => [name, [{ name: "_id_", key: { _id: 1 } }]])) as Record<string, { name: string; key: Document }[]> };
}
