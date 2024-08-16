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

export interface AirtableSchemaResponse {
  tables: AirtableTable[];
}

export interface AirtableTable {
  id: string;
  name: string;
  primaryFieldId: string;
  fields: AirtableField[];
  views: AirtableView[];
}

export interface AirtableField {
  type: string;
  id: string;
  name: string;
  options?: AirtableFieldOptions;
}

interface AirtableView {
  id: string;
  name: string;
  type: string;
}
// Don't really care about the options for now
// TODO: Add options types?
type AirtableFieldOptions = Record<string, unknown>;
