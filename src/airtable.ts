type AirtableAPIAllowedKeys =
  | "createdTime"
  | "id"
  | "fields";

type AirtableRecord = Record<AirtableAPIAllowedKeys, unknown>;
