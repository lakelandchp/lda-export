export const insertRecordsSQL = (tableName: string) => `
INSERT OR REPLACE INTO ${tableName} (airtableId, airtableCreationTime, fields)
VALUES (?, ?, ?)`;

export const insertOperationsSQL = `
INSERT INTO operations (airtableId, operationTypeId, operationTime, recordSnapshot)
VALUES (?, ?, ?, ?)`;
