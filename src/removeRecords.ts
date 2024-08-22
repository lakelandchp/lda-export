import { getLatestFile } from "./utils/fileLoader.ts";
import { AirtableRecord } from "./types.ts";

const itemRegex = /^Items.*\.json$/;

// This currently only identifies records that have the "remove (from linked_admin_info)" field set to true
// TODO: complete this function to remove records from Airtable
type RemoveOptions = {
  dryrun: boolean;
};

export async function identifyRecordsToRemove() {
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

  return recordsToRemove;
}

export async function removeRecords(
  options: RemoveOptions = { dryrun: false },
) {
  const { dryrun } = options;

  const recordsToRemove = await identifyRecordsToRemove();
  if (recordsToRemove && recordsToRemove.length > 0) {
    console.log(`Found ${recordsToRemove.length} records to remove.`);
    if (dryrun) {
      console.log("Printing the first record...");
      console.log(recordsToRemove[0]);
      return;
    } else {
      console.log("Removing records...");
    }
  } else {
    console.log("No records to remove.");
  }
}
