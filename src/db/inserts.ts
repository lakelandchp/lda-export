export const insertRecordsSQL = (tableName: string) => `
INSERT OR REPLACE INTO ${tableName} (airtableId, airtableCreationTime, fields)
VALUES (?, ?, ?)`;
