/**
 * Multi-tag helpers.
 * The `note` field stores comma-separated tags (e.g., "Reimbursable, Shared, Q3").
 * These helpers parse and normalize them into individual tag chips.
 */

/** Parse a comma-separated note string into an array of trimmed tags. */
export function parseTags(note: string | null | undefined): string[] {
  if (!note) return [];
  return note
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/** Render tags back to a comma-separated string for storage. */
export function serializeTags(tags: string[]): string {
  return tags.join(", ");
}

/** Add a tag to an existing note string (dedupes, case-insensitive). */
export function addTag(note: string | null | undefined, tag: string): string {
  const tags = parseTags(note);
  const normalized = tag.trim();
  if (!normalized) return serializeTags(tags);
  if (!tags.some((t) => t.toLowerCase() === normalized.toLowerCase())) {
    tags.push(normalized);
  }
  return serializeTags(tags);
}

/** Remove a tag from an existing note string (case-insensitive). */
export function removeTag(note: string | null | undefined, tag: string): string {
  const tags = parseTags(note).filter(
    (t) => t.toLowerCase() !== tag.toLowerCase()
  );
  return serializeTags(tags);
}

/** All distinct tags across a set of notes (for tag-cloud / filter usage). */
export function allTags(notes: (string | null | undefined)[]): string[] {
  const set = new Set<string>();
  for (const n of notes) {
    for (const t of parseTags(n)) {
      set.add(t);
    }
  }
  return Array.from(set).sort();
}
