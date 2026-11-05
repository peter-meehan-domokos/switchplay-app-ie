// A compact-label recommendation, not a limit on stored Group names.
export const COMPACT_GROUP_NAME_LENGTH = 15;
export function compactGroupName(name: string) {
  const characters = Array.from(name);
  return characters.length > COMPACT_GROUP_NAME_LENGTH
    ? `${characters.slice(0, COMPACT_GROUP_NAME_LENGTH - 1).join("").trimEnd()}…`
    : name;
}
