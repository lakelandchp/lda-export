export interface WriterConfig {
  outputDir: string;
}

export interface IWriter {
  readonly outputDir: string;
  writeData(baseData: Map<string, Record<string, unknown>[]> | unknown[]): void;
}

export interface AirtableConfig {
  baseId: string;
  apiKey: string;
  httpReadTimeout?: number;
  userAgent?: string | null;
  delay?: number;
  fetchFn?: typeof fetch;
}

export interface FetchOptions extends AirtableConfig {
  tableName: string;
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
