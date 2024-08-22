export function sanitizeSQLiteTableName(input: string): string {
  let sanitized = input.trim();
  sanitized = sanitized.replace(/[\s-(),;.]/g, "_");
  sanitized = sanitized.replace(/[^a-zA-Z0-9_]/g, "");
  if (/^\d/.test(sanitized)) {
    sanitized = "_" + sanitized;
  }

  // Truncate to 63 characters (SQLite's limit)
  sanitized = sanitized.slice(0, 63);

  // Step 6: Ensure the name isn't empty
  if (sanitized.length === 0) {
    throw new Error(`Cannot convert to a valid SQLite table name: "${input}"`);
  }

  return sanitized;
}
