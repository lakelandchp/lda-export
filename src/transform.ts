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

interface Item {
  id: string;
  airtable_record_id: string;
  order: number;
  suppress_display: boolean;
}

interface OptionalItemFields {
  parent?: string;
  type?: string[];
  asset?: Attachment;
  projects?: Projects;
}

// Can't really do anything useful without these keys
interface WebItem extends Item, OptionalItemFields {
  title: string;
  description: string;
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

// Some properties which should always be single values are
// stored as arrays because Airtable. Convert them to single values.
function pluck(valueList: unknown[]): unknown | void {
  if (valueList.length > 1) {
    throw `Too many values in list.`;
  }
  return valueList[0];
}

function processRecord(
  rec: Readonly<AirtableRecord>,
): { [key: string]: unknown } | void {
  const airtableRecordId: string = rec.id;
  let _airtableRecordCreatedTime: null; // Ignoring this key on purpose
  const fields: Record<string, unknown> = rec.fields;

  // fields object could have all sorts of keys depending
  // on what table it was created from so we need to affirmatively
  // grab the keys we need.
  const {
    item_id,
    title,
    description,
    item_type,
    has_remove_reason,
    reference_attachment,
    part_of_object,
    object_order,
    linked_subjects,
    linked_entities,
  } = fields;

  let chapter, page;
  if (fields["lakeland_book_page (from book_info)"]) {
    chapter = pluck(
      fields["lakeland_book_page (from book_info)"] as string[],
    );
  }

  if (fields["lakeland_book_page (from book_info)"]) {
    page = pluck(
      fields["lakeland_book_page (from book_info)"] as number[],
    );
  }

  let book;
  if (chapter && page) {
    book = {
      chapter: chapter,
      pageNumber: page,
    };
  }

  let asset;
  if (reference_attachment && Array.isArray(reference_attachment)) {
    asset = handleAttachment(pluck(reference_attachment) as Attachment);
  }

  const stubRecord = {
    id: item_id,
    airtable_record_id: airtableRecordId,
    title,
    description,
    type: item_type,
    suppress_display: has_remove_reason ? true : false,
    project: book ? { book } : undefined,
    asset: asset ? asset : undefined,
    parent: part_of_object ? pluck(part_of_object as string[]) : undefined,
    order: object_order ? object_order : 1,
    linked_subjects,
    linked_entities,
  };

  return Object.fromEntries(Object.entries(stubRecord).filter(([_, v]) => v));
}

export function reshape(recordMap: Map<string, AirtableRecord[]>): WebItem[] {
  const itemsData = recordMap.get("Items");
  if (!itemsData) {
    throw new Error(
      `Items table is required. Please re-run with ${
        yellow('"Items"')
      } in table list.`,
    );
  } else {
    const webItems = (itemsData.map(processRecord) as unknown) as WebItem[];
    return webItems;
  }
}
