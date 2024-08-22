import { chunk } from "std/collections/chunk";
import { getLatestFile } from "./utils/fileLoader.ts";
import { getAirtableClient } from "./client.ts";
import { getSQLiteWriter } from "./writer/index.ts";
import { AirtableRecord } from "./types.ts";

const itemRegex = /^Items.*\.json$/;

type RemoveOptions = {
  dryrun: boolean;
  batchSize?: number;
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
        // "remove (from linked_admin_info)" in record.fields &&
        // record.fields["remove (from linked_admin_info)"][0] === true
        // Test with dummy record
        record.id === "recnCbAit8RJGUdmb"
      ) {
        recordsToRemove.push(record);
        console.log("Found record to remove:", record);
      }
    }
  }

  return recordsToRemove;
}

function deleteRecordsFromLocalDatabase(recordIds: string[]) {
  const sqliteWriter = getSQLiteWriter();
  sqliteWriter.deleteItemRecords(recordIds);
}
async function deleteRecordsFromAirtable(recordIds: string[]) {
  const client = getAirtableClient();
  try {
    await client.deleteItemRecords(recordIds);
  } catch (error) {
    console.error("Error deleting records from Airtable:", error);
  }
}
export async function removeRecords(
  options: RemoveOptions = { dryrun: false },
) {
  const { dryrun } = options;

  const recordsToRemove = await identifyRecordsToRemove();
  if (recordsToRemove && recordsToRemove.length > 0) {
    console.log(`Found ${recordsToRemove.length} records to remove.`);
    if (dryrun) {
      return;
    } else {
      console.log("Removing records...");
      const { batchSize } = options;
      const batches = chunk(recordsToRemove, batchSize || 10);
      for (const batch of batches) {
        const recordIds = batch.map((record) => record.id);
        try {
          deleteRecordsFromAirtable(recordIds);
          deleteRecordsFromLocalDatabase(recordIds);
        } catch (error) {
          console.error("Error deleting records", error);
        }
      }
    }
  } else {
    console.log("No records to remove.");
  }
}

async function createRecordInAirtable(record: string) {
  const client = getAirtableClient();
  try {
    await client.restoreItemRecord(JSON.parse(record));
  } catch (error) {
    console.error("Error restoring record:", error);
  }
}

function filterRecordsToRestore(snapshots: string[]) {
  return snapshots.map((snapshot) => {
    try {
      const record = JSON.parse(snapshot);
      return record;
    } catch (error) {
      console.error("Error parsing record snapshot:", error);
    }
  });
}
export async function restoreRecords(
  airtableIds: string[],
  options: RemoveOptions = { dryrun: false },
) {
  const sqliteWriter = getSQLiteWriter();
  const { dryrun } = options;

  const recordSnapshots = sqliteWriter.restoreItemRecords(airtableIds);
  if (recordSnapshots && recordSnapshots.length > 0) {
    console.log(`Found ${recordSnapshots.length} records to restore.`);
    if (dryrun) {
      return;
    } else {
      console.log("Attempting to restore records...");
      const recordBodies = filterRecordsToRestore(recordSnapshots);
      for (const record of recordBodies) {
        try {
          await createRecordInAirtable(record);
        } catch (error) {
          console.error("Error restoring records", error);
        }
      }
    }
  }
}
