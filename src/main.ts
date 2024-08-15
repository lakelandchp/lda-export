import { brightGreen, cyan, italic, red, yellow } from "std/fmt/colors";
import { parse } from "std/flags";
import { sleep } from "sleep";
import { join } from "std/path";
import { ensureDirSync } from "std/fs";

async function getAirtableData(
  baseId: string,
  tables: string[],
  apiKey: string,
  httpReadTimeout: number,
  userAgent?: string | null,
  delay = 0.2,
): Promise<Map<string, AirtableRecord[]>> {
  console.log(
    `Connecting to ${cyan(`https://api.airtable.com/v0/${baseId}`)} …`,
  );

  const airtableData = new Map<string, AirtableRecord[]>();

  // Main loop over all tables
  for (const table of tables) {
    console.log(`Fetching ${yellow(table)} …`);
    // The function allRecords() returns a generator that yields  a "page" of
    // records returned by the API. We push these onto our array as they are
    // yielded so that's why we have a list of lists here.
    //
    // Below we use flat() to flatten the list of lists into a single list.
    const records: Array<AirtableRecord[]> = [];

    const tableRecords = allRecords(
      baseId,
      table,
      apiKey,
      httpReadTimeout,
      userAgent,
      delay,
    );

    for await (const recordList of tableRecords) {
      records.push(recordList);
    }

    const res = records.flat();
    console.log(
      `🗄✨ ${italic(brightGreen(res.length.toString()))} records retrieved.`,
    );

    if (!airtableData.get(table)) {
      airtableData.set(table, res);
    } else {
      console.warn(`Data already exists for ${table}. Overwriting.…`);
      airtableData.set(table, res);
    }
  }

  return airtableData;
}

async function* allRecords(
  baseId: string,
  tableName: string,
  apiKey: string,
  httpReadTimeout?: number,
  userAgent?: string | null,
  delay?: number,
): AsyncGenerator<AirtableRecord[], void, void> {
  //   Prepare the request
  const _headers: Array<string[]> = [];
  if (userAgent) {
    _headers.push(["User-Agent", userAgent]);
  }
  _headers.push(["Authorization", `Bearer ${apiKey}`]);
  const requestHeaders = new Headers(_headers);

  let timeout = 8000;
  if (httpReadTimeout) {
    timeout = httpReadTimeout * 1000;
  }

  const controller = new AbortController();
  const cId = setTimeout(() => controller.abort(), timeout);

  // Make the request
  let firstPage = true;
  let offset: null | string = null;
  while (firstPage || offset) {
    firstPage = false;
    let url = `https://api.airtable.com/v0/${baseId}/${tableName}`;
    if (offset) {
      url += `?offset=${offset}`;
    }

    const jsonResponse = await fetch(url, {
      headers: requestHeaders,
      signal: controller.signal,
    });
    const jsonData = await jsonResponse.json();
    offset = jsonData.offset;
    yield new Promise<AirtableRecord[]>((resolve) => resolve(jsonData.records));

    // Don't hit the API too fast
    if (offset && delay) {
      await sleep(delay);
    }
  }

  clearTimeout(cId);
}

function write(
  baseData: Map<string, AirtableRecord[]> | unknown[],
  outputPath: string,
): void {
  ensureDirSync(outputPath);

  if (baseData instanceof Map) {
    for (const [tableName, records] of baseData) {
      const fileName = `${outputPath}/${tableName}.json`;
      try {
        Deno.writeTextFileSync(fileName, JSON.stringify(records));
        console.log(`Records written to ${cyan(fileName)}`);
      } catch (e) {
        console.error(red(`Could not write to ${cyan(fileName)}. Error: ${e}`));
      }
    }
  } else {
    const fileName = `${outputPath}/LDA.json`;
    try {
      Deno.writeTextFileSync(fileName, JSON.stringify(baseData));
      console.log(`Records written to ${cyan(fileName)}`);
    } catch (e) {
      console.error(red(`Could not write to ${cyan(fileName)}. Error: ${e}`));
    }
  }
}

const base = Deno.env.get("AIRTABLE_BASE_ID");
const key = Deno.env.get("AIRTABLE_API_KEY");

const flags = parse(Deno.args);

// Set flags if they are not set
const httpReadTimeout: number = parseInt(flags.httpReadTimeout) || 60;

// Default to curl user agent to look basic
const userAgent: string = flags.userAgent || "curl/7.77.0";
const outputDir: string = flags.outputDir || "./dist";

const ONLYWEB = ["Composite_Objects", "Items", "Subjects", "Entities"];
const ALLTABLES = [
  "Items",
  "Composite_Objects",
  "Entities",
  "Locations",
  "Subjects",
  "Relationships",
  "Item_Admin_Info",
  "Person_Admin_Info",
  "Lakeland_Book",
  "Lakeland_Tour_Sites",
];

if (base && key) {
  if (flags.backup) {
    const allBaseData = await getAirtableData(
      base,
      ALLTABLES,
      key,
      httpReadTimeout,
      userAgent,
    );
    write(allBaseData, join(outputDir, "data", "raw"));
  } else {
    const websiteData = await getAirtableData(
      base,
      ONLYWEB,
      key,
      httpReadTimeout,
      userAgent,
    );
    try {
      const transformedData = reshape(websiteData);
      write(transformedData, join(outputDir, "data", "api"));
    } catch (e) {
      console.error(e);
      Deno.exit(1);
    }
  }
} else {
  console.error(
    red("Error: AIRTABLE_BASE_ID and AIRTABLE_API_KEY must be set"),
  );
}
