import { ensureDirSync } from "std/fs";
import { yellow } from "std/fmt/colors";
import { Database } from "@db/sqlite";
import * as TableStatements from "../db/tables.ts";
import { insertRecordsSQL, insertOperationsSQL } from "../db/inserts.ts";
import { deleteItemRecordsSQL } from "../db/deletes.ts";
import { getItemQuery, getItemFromOperationQuery } from "../db/queries.ts";
import { sanitizeSQLiteTableName } from "../utils/sanitizeNames.ts";
import { IWriter, WriterConfig, AirtableRecord } from "../types.ts";

export interface SQLiteWriterConfig extends WriterConfig {
  db?: Database;
  dbFile?: string;
  batchSize?: number;
}

export class SQLiteWriter implements IWriter {
  private static instance: SQLiteWriter;
  private db: Database;
  private config: SQLiteWriterConfig;
  private tableStatements: Map<string, string>;
  private batchSize: number;
  outputDir: string;

  private constructor(config: SQLiteWriterConfig) {
    this.config = { ...config };

    this.outputDir = this.config.outputDir;
    ensureDirSync(this.config.outputDir);
    this.db = this.config.db || new Database(this.getDatabasePath());
    this.tableStatements = new Map();
    this.batchSize = this.config.batchSize || 50;
    this.initializeTables();
  }

  private getDatabasePath(): string {
    return `${this.outputDir}/${this.config.dbFile || Deno.env.get("DB_FILE") || "lda-export.db"}`;
  }

  private initializeTables() {
    console.log(`Initializing database at ${this.outputDir}`);

    const initializeTablesTransaction = this.db.transaction(() => {
      this.db.exec(TableStatements.createOperationTypesTableSQL);
      this.db.exec(TableStatements.populateOperationTypesTableSQL, [
        TableStatements.OperationTypeId.CREATE,
        TableStatements.OperationTypeId.UPDATE,
        TableStatements.OperationTypeId.DELETE,
      ]);
      this.db.exec(TableStatements.createOperationsTableSQL);
      this.db.exec(TableStatements.createOperationsTableIndexesSQL);
    });

    try {
      initializeTablesTransaction();
      console.log(
        yellow(
          "Initial database tables and indexes initialized successfully 🌱",
        ),
      );
    } catch (error) {
      console.error("Error initializing database tables:", error);
      throw new Error("Failed to initialize database tables");
    }
  }

  static getInstance(config: SQLiteWriterConfig): SQLiteWriter {
    if (!SQLiteWriter.instance) {
      SQLiteWriter.instance = new SQLiteWriter(config);
    }
    return SQLiteWriter.instance;
  }

  private createRecordTable(tableName: string) {
    const sanitizedTableName = sanitizeSQLiteTableName(tableName);
    try {
      this.db.exec(TableStatements.createTableSQL(sanitizedTableName));
      this.db.exec(TableStatements.createIndexSQL(sanitizedTableName));

      this.tableStatements.set(tableName, insertRecordsSQL(sanitizedTableName));
    } catch (error) {
      console.error(`Error creating table ${tableName}`, error);
      throw new Error(`Failed to create table ${tableName}`);
    }
  }

  private isValidAirtableRecord(record: unknown): record is AirtableRecord {
    return (
      typeof record === "object" &&
      record !== null &&
      "id" in record &&
      "createdTime" in record &&
      "fields" in record &&
      typeof record.id === "string" &&
      typeof record.createdTime === "string" &&
      record.fields !== undefined &&
      typeof record.fields === "object" &&
      record.fields !== null
    );
  }
  private insertRecords(tableName: string, records: AirtableRecord[]) {
    if (!this.tableStatements.has(tableName)) {
      this.createRecordTable(tableName);
    }

    const insertSQL = this.tableStatements.get(tableName)!;
    const insertRecordStatement = this.db.prepare(insertSQL);

    const batchRecordInsert = this.db.transaction(() => {
      for (const record of records) {
        insertRecordStatement.run(
          record.id,
          record.createdTime,
          JSON.stringify(record.fields),
        );
      }
    });

    batchRecordInsert();
  }
  writeData(
    baseData: Map<string, Record<string, unknown>[]> | unknown[],
  ): void {
    if (baseData instanceof Map) {
      for (const [tableName, records] of baseData) {
        const recordsWithErrors = [];
        const validRecords = records.filter((record) =>
          this.isValidAirtableRecord(record),
        );
        for (let i = 0; i < validRecords.length; i += this.batchSize) {
          const recordsBatch = validRecords.slice(i, i + this.batchSize);
          try {
            this.insertRecords(tableName, recordsBatch);
          } catch (error) {
            console.error(`Error writing records to table ${tableName}`, error);
            recordsWithErrors.push(...recordsBatch);
            continue;
          }
        }
        if (recordsWithErrors.length > 0) {
          console.log(
            `Table ${tableName} had ${recordsWithErrors.length} errors out of ${records.length} records.`,
          );
          Deno.writeTextFileSync(
            `${this.outputDir}/${tableName}_errors.json`,
            JSON.stringify(recordsWithErrors),
          );
        } else {
          console.log(`Table ${tableName} successfully written to database.`);
        }
      }
    } else {
      throw new Error("Invalid data type passed to SQLiteWriter");
    }
  }

  private writeOperation(
    tableName: string,
    recordQueryResult: unknown[],
    operationTypeId: TableStatements.OperationTypeId,
  ) {
    const insertOperationStatement = this.db.prepare(insertOperationsSQL);

    //TODO: Make this less dependent on knowing the field order of the query result
    const [, airtableId, , recordSnapshot] = recordQueryResult;
    if (typeof airtableId !== "string") {
      throw new Error("Invalid airtableId in recordQueryResult");
    }
    try {
      insertOperationStatement.run(
        airtableId,
        operationTypeId,
        new Date().toISOString(),
        JSON.stringify(recordSnapshot),
      );
    } catch (error) {
      console.error(`Error writing operation to table ${tableName}`, error);
      console.log(airtableId, operationTypeId, recordSnapshot);
      throw new Error(
        `Failed to write operation to table ${tableName}`,
        error.message,
      );
    }
  }

  deleteItemRecords(airtableIds: string[]) {
    const retrieveItemQueryStatement = this.db.prepare(getItemQuery);
    const deleteRecordsStatement = this.db.prepare(deleteItemRecordsSQL);
    const batchDelete = this.db.transaction(() => {
      for (const airtableId of airtableIds) {
        const itemRecordQueryResult =
          retrieveItemQueryStatement.value(airtableId);
        // the record, if it exists, will come back as an array of field values
        if (!itemRecordQueryResult || itemRecordQueryResult.length === 0) {
          console.log(`No item record found for ${airtableId}`);
          continue;
        }

        deleteRecordsStatement.run(airtableId);

        this.writeOperation(
          "Items",
          itemRecordQueryResult,
          TableStatements.OperationTypeId.DELETE,
        );
      }
    });
    try {
      batchDelete();
    } catch (error) {
      console.error(`Error deleting records from database`, error);
      throw new Error(`Failed to delete records from database`);
    }
  }

  private isStringArray(arr: unknown): arr is string[] {
    return Array.isArray(arr) && arr.every((item) => typeof item === "string");
  }
  restoreItemRecords(airtableIds: string[]) {
    const recordSnapshotQueryStatement = this.db.prepare(
      getItemFromOperationQuery,
    );

    const recordSnapshots: string[] = [];

    for (const airtableId of airtableIds) {
      const recordSnapshotQueryResult =
        recordSnapshotQueryStatement.value(airtableId);
      if (
        !recordSnapshotQueryResult ||
        !this.isStringArray(recordSnapshotQueryResult) ||
        recordSnapshotQueryResult.length === 0
      ) {
        console.log(`No item record found for ${airtableId}`);
        continue;
      }

      recordSnapshots.push(recordSnapshotQueryResult[0]);
    }
    return recordSnapshots;
  }
}
export function getSQLiteWriter(
  config?: Partial<SQLiteWriterConfig>,
): SQLiteWriter {
  const defaultConfig: SQLiteWriterConfig = {
    outputDir: Deno.env.get("OUTPUT_DIR") || "./dist/data",
    dbFile: Deno.env.get("DB_FILE") || "lda-export.db",
    batchSize: 50,
  };
  const mergedConfig: SQLiteWriterConfig = { ...defaultConfig, ...config };
  return SQLiteWriter.getInstance(mergedConfig);
}
