export const createTableSQL = (tableName: string) => `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        airtableId TEXT NOT NULL UNIQUE,
        airtableCreationTime DATETIME NOT NULL,
        fields JSON NOT NULL
      )`;

export const createIndexSQL = (tableName: string) => `
CREATE INDEX IF NOT EXISTS idx_${tableName}_airtableId ON ${tableName} (airtableId)`;

export const createOperationTypesTableSQL = `
CREATE TABLE IF NOT EXISTS operationTypes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operationType TEXT NOT NULL UNIQUE
)`;

export const OperationTypeId = {
  CREATE: 1,
  UPDATE: 2,
  DELETE: 3,
} as const;
export type OperationTypeId =
  (typeof OperationTypeId)[keyof typeof OperationTypeId];

export const populateOperationTypesTableSQL = `
INSERT OR IGNORE INTO operationTypes (operationType) VALUES (?), (?), (?);
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
