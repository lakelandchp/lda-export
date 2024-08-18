import { brightGreen, cyan, italic, red, yellow } from "std/fmt/colors";
import { parse } from "std/flags";
import { join } from "std/path";
import { ensureDirSync } from "std/fs";
import { getAirtableClient, AirtableClient } from "./client.ts";
import { tableNames } from "./metadata/extractTableInfo.ts";
import { removeRecords } from "./utils/removeRecords.ts";

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
  const flags = parse(Deno.args);

  // Set flags if they are not set
  const httpReadTimeout: number = parseInt(flags.httpReadTimeout) || 60;
  // Default to curl user agent to look basic for Airtable
  const userAgent: string = flags.userAgent || "curl/7.77.0";
  const outputDir: string = flags.outputDir || "./dist";
  const dryrun: boolean = flags.dryrun || false;

  try {
    const client: AirtableClient = getAirtableClient({
      httpReadTimeout,
      userAgent,
    });

    // Pull the current table names from the latest API response
    const ALLTABLES = tableNames;

    if (flags.backup) {
      const allBaseData = await client.getAllTablesData(ALLTABLES);

      writeData(allBaseData, join(outputDir, "data", "raw"), console);
    } else if (flags.remove) {
      if (dryrun) {
        await removeRecords({ dryrun: true });
      }
    }
  } catch (error) {
    console.error(red(`Unhandled error in getAirtableData: ${error}`));
    Deno.exit(1);
  }
}
if (import.meta.main) {
  main().catch((error) => {
    console.error(red(`Unhandled error in main: ${error}`));
    Deno.exit(1);
  });
}
