import { ensureDirSync } from "std/fs";
import { yellow } from "std/fmt/colors";
import { Database } from "@db/sqlite";
import * as TableStatements from "../db/tables.ts";
import { insertRecordsSQL } from "../db/inserts.ts";
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
      this.db.exec(TableStatements.populateOperationTypesTableSQL);
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
