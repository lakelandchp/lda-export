import { getLatestFile } from "./fileLoader.ts";
import { AirtableRecord } from "../types.ts";

const itemRegex = /^Items.*\.json$/;

// This currently only identifies records that have the "remove (from linked_admin_info)" field set to true
// and logs the record id and title to the console.
// TODO: flesh this out into a function that identifies records to remove then removed them via the Airtable API
type RemoveOptions = {
  dryrun: boolean;
};

export async function removeRecords(
  options: RemoveOptions = { dryrun: false },
) {
  const { dryrun } = options;
  const itemData = await getLatestFile(itemRegex);

  if (!itemData || !Array.isArray(itemData)) {
    console.error("No records found or itemData is not in the expected format");
    console.error(itemData);
    return;
  }

  const recordsToRemove: AirtableRecord[] = [];

  for (const record of itemData) {
    // console.log("id", record.id);
    if (record.fields) {
      if (
        "remove (from linked_admin_info)" in record.fields &&
        record.fields["remove (from linked_admin_info)"][0] === true
      ) {
        recordsToRemove.push(record);
      }
    }
  }

  if (recordsToRemove.length > 0) {
    console.log(`Found ${recordsToRemove.length} records to remove.`);
  } else {
    console.log("No records to remove.");
  }

  if (dryrun) {
    return;
  }
}
