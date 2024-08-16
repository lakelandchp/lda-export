import { getAndImportLatestSchemaResponse } from "./getSchemaResponse.ts";
import { AirtableSchemaResponse } from "./types.ts";

const schemaResponse: AirtableSchemaResponse =
  await getAndImportLatestSchemaResponse();

function extractTableInfo(response: AirtableSchemaResponse) {
  const tables = response.tables;

  return tables.map((table) => table.name);
}

export const tableNames = extractTableInfo(schemaResponse);
