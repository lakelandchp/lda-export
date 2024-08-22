import { brightGreen, cyan, italic, red, yellow } from "std/fmt/colors";
import { parse } from "std/flags";
import { getAirtableClient, AirtableClient } from "./client.ts";
import { tableNames } from "./metadata/extractTableInfo.ts";
import { removeRecords } from "./removeRecords.ts";
import { getJSONWriter, getSQLiteWriter } from "./writer/index.ts";

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

    // Default to JSON writer unless sqlite is specified
    let writer;
    if (flags.sqlite) {
      writer = getSQLiteWriter({ outputDir });
    } else {
      writer = getJSONWriter({ outputDir });
    }
    console.log(brightGreen(`Writing to ${writer.outputDir}`));

    if (flags.backup) {
      const allBaseData = await client.getAllTablesData(ALLTABLES);

      writer.writeData(allBaseData);
    } else if (flags.remove) {
      if (dryrun) {
        await removeRecords({ dryrun: true });
      } else {
        await removeRecords();
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
