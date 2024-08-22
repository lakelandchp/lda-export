export const createRecordsTableSQL = `
CREATE TABLE IF NOT EXISTS records (
id INTEGER PRIMARY KEY AUTOINCREMENT,
    airtableId TEXT NOT NULL UNIQUE,
    airtableCreationTime DATETIME NOT NULL,
    fields JSON NOT NULL
)`;

export const createRecordsTableIndexesSQL = `
CREATE INDEX IF NOT EXISTS idx_records_airtableId ON records (airtableId);
`;

export const createOperationTypesTableSQL = `
CREATE TABLE IF NOT EXISTS operationTypes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operationType TEXT NOT NULL UNIQUE
)`;

export const populateOperationTypesTableSQL = `
INSERT OR IGNORE INTO operationTypes (operationType) VALUES ('CREATE'), ('UPDATE'), ('DELETE');
`;

export const createOperationsTableSQL = `
CREATE TABLE IF NOT EXISTS operations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  airtableId TEXT NOT NULL,
  operationTypeId INTEGER NOT NULL,
  operationTime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  recordSnapshot JSON NOT NULL,
  FOREIGN KEY (operationTypeId) REFERENCES operationTypes(id)
)`;

export const createOperationsTableIndexesSQL = `
CREATE INDEX IF NOT EXISTS idx_operations_airtableId ON operations (airtableId);
CREATE INDEX IF NOT EXISTS idx_operations_operationTypeId ON operations (operationTypeId);
CREATE INDEX IF NOT EXISTS idx_operations_operationTime ON operations (operationTime);
`;
