import { ensureDirSync } from "std/fs";
import { IWriter, WriterConfig } from "../types.ts";

export class JSONWriter implements IWriter {
  private static instance: JSONWriter;
  private config: WriterConfig;
  outputDir: string;

  private constructor(config: WriterConfig) {
    this.config = { ...config };
    ensureDirSync(this.config.outputDir);
    this.outputDir = this.config.outputDir;
  }

  getOutputDir() {
    return this.config.outputDir;
  }
  static getInstance(config?: WriterConfig): JSONWriter {
    if (!JSONWriter.instance) {
      const defaultConfig: WriterConfig = {
        outputDir: Deno.env.get("OUTPUT_DIR") || "./dist/data/raw",
      };
      JSONWriter.instance = new JSONWriter(config || defaultConfig);
    }
    return JSONWriter.instance;
  }

  writeData(baseData: Map<string, Record<string, unknown>[]> | unknown[]) {
    if (baseData instanceof Map) {
      for (const [tableName, records] of baseData) {
        const fileName = `${this.config.outputDir}/${tableName}.json`;
        try {
          Deno.writeTextFileSync(fileName, JSON.stringify(records));
        } catch (error) {
          throw new Error(`Could not write to ${fileName}. Error: ${error}`);
        }
      }
    } else {
      throw new Error("Invalid data type passed to JSONWriter");
    }
  }
}

export function getJSONWriter(config?: WriterConfig): JSONWriter {
  return JSONWriter.getInstance(config);
}
