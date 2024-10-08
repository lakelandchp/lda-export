import { AirtableRecord, AirtableResponse } from "./types.ts";
import { sleep } from "sleep";
import { AirtableConfig } from "./types.ts";

export interface IAirtableClient {
  getTableData(tableName: string): Promise<Record<string, unknown>[]>;
  getAllTablesData(
    tableNames: string[],
  ): Promise<Map<string, Record<string, unknown>[]>>;
  deleteItemRecords(recordIds: string[]): Promise<DeletedRecords>;
  restoreItemRecord(recordIds: AirtableRecord["fields"]): void;
}

interface DeletedRecord {
  id: string;
  deleted: boolean;
}

interface DeletedRecords {
  records: DeletedRecord[];
}

const BASE_API_URL =
  Deno.env.get("AIRTABLE_API_URL") || "https://api.airtable.com/v0";

export class AirtableClient implements IAirtableClient {
  private static instance: AirtableClient | null = null;
  private config: AirtableConfig;
  private fetchFn: typeof fetch;

  private constructor(config: AirtableConfig) {
    this.config = { ...config };
    this.fetchFn = config.fetchFn || fetch;
  }

  static getInstance(userConfig?: Partial<AirtableConfig>): AirtableClient {
    if (!AirtableClient.instance) {
      const defaultConfig: AirtableConfig = {
        baseId: Deno.env.get("AIRTABLE_BASE_ID") || "",
        apiKey: Deno.env.get("AIRTABLE_API_KEY") || "",
        httpReadTimeout: 60,
        userAgent: "curl/7.77.0",
      };

      const mergedConfig: AirtableConfig = {
        ...defaultConfig,
        ...userConfig,
      };

      if (!mergedConfig.baseId || !mergedConfig.apiKey) {
        throw new Error(
          "AIRTABLE_BASE_ID and AIRTABLE_API_KEY must be set in environment variables or provided in config",
        );
      }
      AirtableClient.instance = new AirtableClient(mergedConfig);
    }
    return AirtableClient.instance;
  }

  private constructUrl(tableName: string, offset?: string): string {
    return `${BASE_API_URL}/${this.config.baseId}/${tableName}${offset ? `?offset=${offset}` : ""}`;
  }

  private constructHeaders(): Headers {
    const headers = new Headers();
    if (this.config.userAgent) {
      headers.set("User-Agent", this.config.userAgent);
    }
    headers.set("Authorization", `Bearer ${this.config.apiKey}`);
    return headers;
  }

  private constructAbortController() {
    const controller = new AbortController();
    const timeout = (this.config.httpReadTimeout || 8) * 1000;
    const controllerId = setTimeout(() => controller.abort(), timeout);
    return { controller, controllerId };
  }
  private async *getAllRecords(tableName: string) {
    let offset: string | undefined;
    const headers = this.constructHeaders();

    do {
      const url = this.constructUrl(tableName, offset);
      const { controller, controllerId } = this.constructAbortController();

      try {
        const response = await this.fetchFn(url, {
          headers,
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }

        const jsonData: AirtableResponse = await response.json();
        yield jsonData.records;
        offset = jsonData.offset;

        if (offset && this.config.delay) {
          await sleep(this.config.delay);
        }
      } catch (error) {
        console.error("Error fetching records", error);
        throw error;
      } finally {
        clearTimeout(controllerId);
      }
    } while (offset);
  }

  async getTableData(tableName: string): Promise<Record<string, unknown>[]> {
    const allRecords: Record<string, unknown>[] = [];
    for await (const records of this.getAllRecords(tableName)) {
      allRecords.push(...records);
    }
    return allRecords;
  }

  async getAllTablesData(
    tableNames: string[],
  ): Promise<Map<string, Record<string, unknown>[]>> {
    const allData = new Map<string, Record<string, unknown>[]>();

    for (const tableName of tableNames) {
      console.log(`Fetching ${tableName} ...`);
      const tableData = await this.getTableData(tableName);
      allData.set(tableName, tableData);
      console.log(
        `🗄✨ ${tableData.length} records retrieved for ${tableName}.`,
      );
    }

    return allData;
  }

  private checkRecordListLength(recordList: string[]) {
    if (recordList.length === 0) {
      return { records: [] };
    }
    if (recordList.length > 10) {
      throw new Error(
        "Airtable API only supports deleting up to 10 records at a time",
      );
    }
  }
  async deleteItemRecords(recordIds: string[]): Promise<DeletedRecords> {
    this.checkRecordListLength(recordIds);

    const url = new URL(`${BASE_API_URL}/${this.config.baseId}/Items`);
    recordIds.forEach((id) => url.searchParams.append("records[]", id));

    const headers = this.constructHeaders();
    const { controller, controllerId } = this.constructAbortController();

    try {
      const response = await this.fetchFn(url.toString(), {
        method: "DELETE",
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `HTTP error ${response.status}: ${await response.text()}`,
        );
      }

      const result: DeletedRecords = await response.json();
      return result;
    } catch (error) {
      console.error("Error deleting Item records", error);
      throw error;
    } finally {
      clearTimeout(controllerId);
    }
  }

  async restoreItemRecord(record: AirtableRecord["fields"]): Promise<void> {
    const url = new URL(`${BASE_API_URL}/${this.config.baseId}/Items`);
    const headers = this.constructHeaders();
    headers.set("Content-Type", "application/json");
    const { controller, controllerId } = this.constructAbortController();

    const disallowedFields = ["Airtable Record ID"];

    const sanitizedRecord = Object.fromEntries(
      Object.entries(record).filter(([key]) => !disallowedFields.includes(key)),
    );

    const body = JSON.stringify({
      records: [{ fields: sanitizedRecord }],
    });

    try {
      const response = await this.fetchFn(url.toString(), {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `HTTP error ${response.status}: ${await response.text()}`,
        );
      }

      const result = await response.json();
      console.log("Record restored successfully:", result);
    } catch (error) {
      console.error("Error deleting Item records", error);
      throw error;
    } finally {
      clearTimeout(controllerId);
    }
  }
}

export function getAirtableClient(
  userConfig?: Partial<AirtableConfig>,
): AirtableClient {
  return AirtableClient.getInstance(userConfig);
}
