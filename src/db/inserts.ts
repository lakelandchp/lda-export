export const insertRecordsSQL = (tableName: string) => `
INSERT INTO ${tableName} (airtableId, airtableCreationTime, fields)
VALUES (?, ?, ?)`;
