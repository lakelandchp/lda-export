export interface FetchOptions {
  baseId: string;
  tableName: string;
  apiKey: string;
  httpReadTimeout?: number;
  userAgent?: string | null;
  delay?: number;
}

export interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

export interface AirtableResponse {
  records: Record<string, AirtableRecord>[];
  offset?: string;
}
