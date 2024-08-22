import { ensureDirSync } from "std/fs";
import { yellow } from "std/fmt/colors";
import { Database } from "@db/sqlite";
import * as TableStatements from "../db/tables.ts";
import { IWriter, WriterConfig } from "../types.ts";

export interface SQLiteWriterConfig extends WriterConfig {
  db?: Database;
  dbFile?: string;
}

export class SQLiteWriter implements IWriter {
  private static instance: SQLiteWriter;
  private db: Database;
  private config: SQLiteWriterConfig;
  outputDir: string;

  private constructor(config: SQLiteWriterConfig) {
    this.config = { ...config };

    this.outputDir = this.config.outputDir;
    ensureDirSync(this.config.outputDir);
    this.db = this.config.db || new Database(this.getDatabasePath());
    this.initializeTables();
  }

  private getDatabasePath(): string {
    return `${this.outputDir}/${this.config.dbFile || Deno.env.get("DB_FILE") || "lda-export.db"}`;
  }

  private initializeTables() {
    console.log(`Initializing database at ${this.outputDir}`);

    const initializeTablesTransaction = this.db.transaction(() => {
      this.db.exec(TableStatements.createRecordsTableSQL);
      this.db.exec(TableStatements.createRecordsTableIndexesSQL);
      this.db.exec(TableStatements.createOperationTypesTableSQL);
      this.db.exec(TableStatements.populateOperationTypesTableSQL);
      this.db.exec(TableStatements.createOperationsTableSQL);
      this.db.exec(TableStatements.createOperationsTableIndexesSQL);
    });

    try {
      initializeTablesTransaction();
      console.log(
        yellow("Database tables and indexes initialized successfully 🌱"),
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

  writeData(
    baseData: Map<string, Record<string, unknown>[]> | unknown[],
  ): void {
    console.log("Writing data to SQLite");
  }
}
export function getSQLiteWriter(
  config?: Partial<SQLiteWriterConfig>,
): SQLiteWriter {
  const defaultConfig: SQLiteWriterConfig = {
    outputDir: Deno.env.get("OUTPUT_DIR") || "./dist/data",
    dbFile: Deno.env.get("DB_FILE") || "lda-export.db",
  };
  const mergedConfig: SQLiteWriterConfig = { ...defaultConfig, ...config };
  return SQLiteWriter.getInstance(mergedConfig);
}
