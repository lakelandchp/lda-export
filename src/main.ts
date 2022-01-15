import {
  brightGreen,
  cyan,
  ensureDirSync,
  italic,
  join,
  parse,
  red,
  sleep,
  yellow,
} from "./deps.ts";
import { AirtableRecord } from "./airtable.ts";
import { reshape } from "./transform.ts";

async function getAirtableData(
  baseId: string,
  tables: string[],
  apiKey: string,
  outputDir: string,
  httpReadTimeout: number,
  userAgent?: string | null,
  delay = 0.2,
): Promise<void> {
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

    // Write the raw Airtable data to file before we finish
    const rawPath = join(outputDir, "data", "raw");
    ensureDirSync(rawPath);
    const fileName = `${rawPath}/${table}.json`;
    try {
      Deno.writeTextFileSync(fileName, JSON.stringify(airtableData.get(table)));
    } catch (e) {
      console.error(red(`Could not write to ${cyan(fileName)}. Error: ${e}`));
    }
  }

  let itemAPIResponse;
  try {
    itemAPIResponse = reshape(airtableData);
  } catch (e) {
    console.error(red(e.message));
    Deno.exit(1);
  }

  //  Write the transformed data to file
  const transformedPath = join(outputDir, "data", "api");
  ensureDirSync(transformedPath);
  console.log(`Records will be written to ${cyan(transformedPath)}`);
  const fileName = `${transformedPath}/LDA.json`;
  try {
    Deno.writeTextFileSync(fileName, JSON.stringify(itemAPIResponse));
  } catch (e) {
    console.error(red(`Could not write to ${cyan(fileName)}. Error: ${e}`));
  }
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
    getAirtableData(
      base,
      ALLTABLES,
      key,
      outputDir,
      httpReadTimeout,
      userAgent,
    );
  } else {
    getAirtableData(base, ONLYWEB, key, outputDir, httpReadTimeout, userAgent);
  }
} else {
  console.error(
    red("Error: AIRTABLE_BASE_ID and AIRTABLE_API_KEY must be set"),
  );
}
