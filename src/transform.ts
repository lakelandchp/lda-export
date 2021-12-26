import { yellow } from "https://deno.land/std@0.119.0/fmt/colors.ts";
import { AirtableAttachment, AirtableRecord } from "./airtable.ts";

type Attachment = {
  id: string;
  filename: string;
  versions: AttachmentVersion;
  max_size?: number;
  mimetype?: string;
};

type ImageVersionAllowedKeys = "small" | "large" | "full" | "original";
type AttachmentVersion = Record<ImageVersionAllowedKeys, Image>;

type Image = {
  url: string;
  width: number;
  height: number;
};

type BookInfo = {
  page: number;
  chapter: string;
};

// These are stubs for now
type TourInfo = Record<never, never>;
type VideoInfo = Record<never, never>;

type Projects = {
  book?: BookInfo;
  tour?: TourInfo;
  video?: VideoInfo;
};

type WebItem = {
  id: string;
  airtable_record_id: string;
  title: string;
  description: string;
  order: number;
  suppress_display: boolean;
  type?: string[];
  asset?: Attachment;
  projects?: Projects;
};

// type Subset<T, U extends keyof T> = { [K in U]: T[K] };

// function subset<T, U extends keyof T>(obj: T, keys: U[]): Subset<T, U> {
//   const subsetted = Object.fromEntries(
//     Object.entries(obj).filter(([key]) => keys.includes(key as U)),
//   );

//   // TODO: Make typing more correct
//   return subsetted as Subset<T, U>;
// }

type _FieldValues =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | Record<string, unknown>;

type _FieldsObject = Record<
  string,
  _FieldValues
>;

function rename(key: string, value: _FieldValues): Partial<WebItem> {
  switch (key) {
    case "id":
      return { airtable_record_id: value as string };
    case "item_id":
      return { id: value as string };
    case "item_type":
      return { type: value as string[] };
    case "object_order":
      return { order: value as number };
    default:
      throw "Unknown field to rename";
  }
}

// Some properties which should always be single values are
// stored as arrays because Airtable. Convert them to single values.
function pluck(
  key: string,
  value: unknown[],
): unknown | void {
  if (value.length > 1) {
    throw `Too many values in ${key}`;
  }
  return value[0];
}

function setBoolValue(key: string, value: _FieldValues): Partial<WebItem> {
  if (value instanceof Array) {
    if (value.length > 0) {
      return { "suppress_display": true };
    } else {
      // This will never be executed because the key
      // is not present if the value is empty but this
      // satisfies the compiler
      return { "suppress_display": false };
    }
  } else {
    throw `${key} is not an object. Did the type of ${key} change in Airtable?`;
  }
}

function handleAttachment(attachmentObj: unknown): Attachment {
  const attachmentSrc = attachmentObj as AirtableAttachment;
  const { id, filename, size, width, height, url, thumbnails, type } =
    attachmentSrc;

  const versions: AttachmentVersion = {
    original: {
      width,
      height,
      url,
    },
    ...thumbnails,
  };

  const attachment: Attachment = {
    id,
    filename,
    max_size: size,
    mimetype: type,
    versions,
  };
  return attachment;
}

function processRecord(rec: AirtableRecord): WebItem {
  const recordData: _FieldsObject = rec.fields;

  const stubRecord: Partial<WebItem> = {};
  let id, type, order, suppress_display, asset, chapter, pageNumber;

  // If properties are present, process them
  for (const [key, value] of Object.entries(recordData)) {
    if (typeof value === "string") {
      switch (key) {
        case "title":
          stubRecord.title = value;
          break;
        case "description":
          stubRecord.description = value;
          break;
        case "item_id":
          id = rename(key, value);
          break;
        default:
          break;
      }
    }

    if (typeof value === "number") {
      if (key === "object_order") {
        order = rename(key, value);
      }
    }

    if (Array.isArray(value)) {
      switch (key) {
        case "item_type":
          type = rename(key, value);
          break;
        case "has_remove_reason":
          suppress_display = setBoolValue(key, value);
          break;
        case "lakeland_book_chapter (from book_info)":
          chapter = pluck(key, value as string[]);
          break;
        case "lakeland_book_page (from book_info)":
          pageNumber = pluck(key, value as number[]);
          break;
        case "reference_attachment":
          asset = handleAttachment(pluck(key, value));
          break;
        default:
          break;
      }
    }
  }
  // The record id is at the top level of the original record not in "fields"
  const airtableId = rename("id", rec.id);

  if (chapter && pageNumber) {
    if (typeof chapter === "string" && typeof pageNumber === "number") {
      stubRecord.projects = {
        book: {
          chapter,
          page: pageNumber,
        },
      };
    }
  }

  if (asset) {
    stubRecord.asset = asset;
  }

  const newWebItem = {
    ...stubRecord,
    ...airtableId,
    ...id,
    ...type,
    ...order,
    ...suppress_display,
  };

  return newWebItem as WebItem;
}

export function reshape(recordMap: Map<string, AirtableRecord[]>): WebItem[] {
  // export function reshape(recordMap: Map<string, AirtableRecord[]>): void {
  const itemData = recordMap.get("Items");
  if (!itemData) {
    throw new Error(
      `Items table is required. Please re-run with ${
        yellow('"Items"')
      } in table list.`,
    );
  } else {
    const webRecords = itemData.map(processRecord);
    return webRecords;
  }
}
