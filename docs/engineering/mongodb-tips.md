# MongoDB Atlas – Useful Editing Notes & Workarounds

## Context

While implementing the DeckData sharing feature, we discovered several quirks with the MongoDB Atlas document editor. This document records the workarounds that proved reliable.

---

# 1. Editing simple values works normally

The Atlas document editor can edit scalar values (strings, booleans, numbers, etc.) without issue.

Example:

- username
- email
- booleans
- dates

These can simply be edited in-place and saved.

---

# 2. Adding complex objects via the visual editor may silently fail

In our case:

- `Add field`
- `Add item to <array>`

appeared in the menu, but clicking either option simply closed the menu without creating anything.

This occurred:

- in Safari
- in Chrome
- while already in Edit mode
- despite having full write permissions

This appears to be an Atlas UI issue rather than a permissions problem.

---

# 3. Use Bulk Update Documents instead

Rather than fighting the visual editor, use:

**Documents → Bulk Update Documents**

This proved much more reliable.

---

# 4. Use `$set` to create missing fields

MongoDB automatically creates missing fields when using `$set`.

Example:

```javascript
{
  $set: {
    sharedDeckData: [
      {
        deckTemplateId: "...",
        deckUserId: "..."
      }
    ]
  }
}
```

The field does **not** need to exist beforehand.

---

# 5. Remember where sharing fields actually live

There are three different objects involved.

## Deck Template

Contains template information only.

**Does NOT contain sharing information.**

---

## User

Contains:

```ts
sharedDeckData
```

This is:

> Which other users' DeckData has been shared with me?

---

## DeckData

Embedded inside the owning user's document.

Contains:

```ts
sharedWithUserIds
```

This is:

> Which users may view this DeckData?

---

# 6. Positional `$` updates may not work in Atlas Bulk Update

Although this works perfectly from application code:

```javascript
{
  $set: {
    "decksData.$.sharedWithUserIds": [...]
  }
}
```

Atlas Bulk Update reported:

> The positional operator did not find the match needed from the query.

even though the filter successfully matched the document.

---

# 7. Matching the document is NOT enough

This filter correctly matched the owner document:

```javascript
{
  _id: ObjectId("..."),
  "decksData.deckTemplateId": "deck-2026-06-music-001"
}
```

The document was returned correctly.

However, Atlas Bulk Update still failed when using the positional `$` operator.

---

# 8. Array Filters were not available

Attempting:

```javascript
decksData.$[deck]
```

produced:

> No array filter found for identifier 'deck'

The Atlas Bulk Update UI did not expose Array Filters.

---

# 9. Reliable workaround: update by array index

Expand the array first.

Find the correct element index:

```
decksData
  0
  1
  2
```

Then update directly.

Example:

```javascript
{
  $set: {
    "decksData.0.sharedWithUserIds": [
      "VIEWER_USER_ID"
    ]
  }
}
```

This worked immediately.

---

# 10. Bulk Update is often easier than the visual editor

For any complex object edits:

- arrays
- embedded objects
- nested fields

prefer **Bulk Update Documents** over the Atlas visual editor.

It is generally faster, clearer and significantly more reliable.

---

# Summary

Recommended approach when editing complex MongoDB documents manually:

1. Use the visual editor only for simple scalar values.
2. Use **Bulk Update Documents** for nested objects and arrays.
3. Use `$set` to create missing fields automatically.
4. If the Atlas positional `$` operator fails, update the embedded document by its array index instead.
5. Remember:
   - `sharedDeckData` lives on the **User**
   - `sharedWithUserIds` lives on **DeckData**
   - **Deck Templates contain neither**.