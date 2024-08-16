import { getLatestFile } from "../utils/fileLoader.ts";
import { resolvePath } from "../utils/pathUtils.ts";
import { AirtableSchemaResponse } from "../types.ts";

const schemaFilePath =
  Deno.env.get("SCHEMA_DIR") || resolvePath("tests", "fixtures", "responses");
const schemaRegex = /^schema_response.*\.json$/;

const schemaResponse: AirtableSchemaResponse = await getLatestFile(
  schemaRegex,
  schemaFilePath,
);
function extractTableInfo(response: AirtableSchemaResponse) {
  const tables = response.tables;

  return tables.map((table) => table.name);
}

export const tableNames = extractTableInfo(schemaResponse);
