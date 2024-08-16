import { brightGreen, cyan, italic, red, yellow } from "std/fmt/colors";
import { parse } from "std/flags";
import { sleep } from "sleep";
import { join } from "std/path";
import { ensureDirSync } from "std/fs";

interface FetchOptions {
  baseId: string;
  tableName: string;
  apiKey: string;
  httpReadTimeout?: number;
  userAgent?: string | null;
  delay?: number;
}

interface AirtableResponse {
  records: Record<string, unknown>[];
  offset?: string;
}
export async function getAirtableData(
  baseId: string,
  tables: string[],
  apiKey: string,
  httpReadTimeout: number,
  fetchFn: typeof fetch,
  logger: typeof console,

  userAgent?: string | null,
  delay = 0.2,
): Promise<Map<string, Record<string, unknown>[]>> {
  console.log(
    `Connecting to ${cyan(`https://api.airtable.com/v0/${baseId}`)} …`,
  );

  const airtableData = new Map<string, Record<string, unknown>[]>();

  // Main loop over all tables
  for (const table of tables) {
    logger.log(`Fetching ${yellow(table)} …`);
    // The function allRecords() returns a generator that yields  a "page" of
    // records returned by the API. We push these onto our array as they are
    // yielded so that's why we have a list of lists here.
    //
    // Below we use flat() to flatten the list of lists into a single list.
    const records: Array<Record<string, unknown>[]> = [];

    const tableRecords = allRecords(
      {
        baseId,
        tableName: table,
        apiKey,
        httpReadTimeout,
        userAgent,
        delay,
      },
      fetchFn,
    );

    for await (const recordList of tableRecords) {
      records.push(recordList);
    }

    const res = records.flat();
    logger.log(
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
  options: FetchOptions,
  fetchFn: typeof fetch,
): AsyncGenerator<Record<string, unknown>[], void, void> {
  const { baseId, tableName, apiKey, httpReadTimeout, userAgent, delay } =
    options;
  //   Prepare the request
  const _headers: Array<string[]> = [];
  if (userAgent) {
    _headers.push(["User-Agent", userAgent]);
  }
  _headers.push(["Authorization", `Bearer ${apiKey}`]);
  const requestHeaders = new Headers(_headers);

  const timeout = (httpReadTimeout || 8) * 1000;
  const controller = new AbortController();
  const cId = setTimeout(() => controller.abort(), timeout);

  // Make the request
  let firstPage = true;
  let offset: string | undefined;
  while (firstPage || offset) {
    firstPage = false;
    let url = `https://api.airtable.com/v0/${baseId}/${tableName}`;
    if (offset) {
      url += `?offset=${offset}`;
    }
    try {
      const jsonResponse = await fetchFn(url, {
        headers: requestHeaders,
        signal: controller.signal,
      });

      const jsonData: AirtableResponse = await jsonResponse.json();
      yield jsonData.records;
      offset = jsonData.offset;

      // Don't hit the API too fast
      if (offset && delay) {
        await sleep(delay);
      }
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      clearTimeout(cId);
    }
  }
}

function writeData(
  baseData: Map<string, Record<string, unknown>[]> | unknown[],
  outputPath: string,
  logger: typeof console,
): void {
  ensureDirSync(outputPath);

  if (baseData instanceof Map) {
    for (const [tableName, records] of baseData) {
      const fileName = `${outputPath}/${tableName}.json`;
      try {
        Deno.writeTextFileSync(fileName, JSON.stringify(records));
        logger.log(`Records written to ${cyan(fileName)}`);
      } catch (e) {
        logger.error(red(`Could not write to ${cyan(fileName)}. Error: ${e}`));
      }
    }
  } else {
    const fileName = `${outputPath}/LDA.json`;
    try {
      Deno.writeTextFileSync(fileName, JSON.stringify(baseData));
      logger.log(`Records written to ${cyan(fileName)}`);
    } catch (e) {
      logger.error(red(`Could not write to ${cyan(fileName)}. Error: ${e}`));
    }
  }
}

export async function main() {
  const base = Deno.env.get("AIRTABLE_BASE_ID");
  const key = Deno.env.get("AIRTABLE_API_KEY");

  const flags = parse(Deno.args);

  // Set flags if they are not set
  const httpReadTimeout: number = parseInt(flags.httpReadTimeout) || 60;

  // Default to curl user agent to look basic
  const userAgent: string = flags.userAgent || "curl/7.77.0";
  const outputDir: string = flags.outputDir || "./dist";

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
      try {
        const allBaseData = await getAirtableData(
          base,
          ALLTABLES,
          key,
          httpReadTimeout,
          fetch,
          console,

          userAgent,
        );

        writeData(allBaseData, join(outputDir, "data", "raw"), console);
      } catch (error) {
        console.error(red(`Unhandled error in getAirtableData: ${error}`));
        Deno.exit(1);
      }
    }
  } else {
    console.error(
      red("Error: AIRTABLE_BASE_ID and AIRTABLE_API_KEY must be set"),
    );
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(red(`Unhandled error in main: ${error}`));
    Deno.exit(1);
  });
}
