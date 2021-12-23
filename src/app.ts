const base = Deno.env.get("AIRTABLE_BASE_ID");
console.log(`Data will be exported from base: ${base}`);

type AirtableRecord = Record<string, any>;

function allRecords(
  baseId: string,
  tableName: string,
  apiKey: string,
  httpReadTimeout?: number,
  userAgent?: string | null,
  sleep: number = 0.2,
): Iterable<AirtableRecord> {
}
