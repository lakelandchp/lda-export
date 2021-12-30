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
  linked_subjects?: string[];
  linked_entities?: string[];
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

function convertIdToName(
  idString: string,
  otherTableRecords: AirtableRecord[] | undefined,
): string | undefined {
  if (!otherTableRecords || otherTableRecords.length === 0) {
    throw `No records found in other table.`;
  }
  const otherTableRecord = otherTableRecords.find((rec) => rec.id === idString);
  const otherTableData = otherTableRecord ? otherTableRecord.fields : undefined;
  if (otherTableData) {
    const { name } = otherTableData;
    return name;
  }
}

function handleMultiPartItems(
  mItems: WebItem[],
  otherTableRecords: AirtableRecord[] | undefined,
): WebItem[] {
  if (!otherTableRecords || otherTableRecords.length === 0) {
    throw `No records found in other table.`;
  }

  const parentItemMap = new Map<string, WebItem[]>();
  mItems.forEach((it) => {
    if (it.parent) {
      if (!parentItemMap.has(it.parent)) {
        parentItemMap.set(it.parent, [it]);
      } else {
        parentItemMap.get(it.parent)!.push(it); // ! is safe because we just checked.
      }
    }
  });

  const newItems = [];

  for (const [parentId, childItems] of parentItemMap) {
    const parentRecord = otherTableRecords.find((rec) => rec.id === parentId);
    const parentData = parentRecord ? parentRecord.fields : undefined;
    if (parentData) {
      const allSubjects: string[] = childItems.map((it) => {
        return it.linked_subjects ? it.linked_subjects : [];
      })
        .flat();
      const allEntities: string[] = childItems.map((it) => {
        return it.linked_entities ? it.linked_entities : [];
      })
        .flat();
      const subjects = [...new Set(allSubjects)];
      const entities = [...new Set(allEntities)];
      const cItemId = parentData.object_id;
      const sortedChildItems = childItems.sort((a, b) => a.order - b.order);
      newItems.push({
        id: cItemId,
        airtable_record_id: parentId,
        title: parentData.object_title,
        description: parentData.object_description,
        linked_subjects: subjects,
        linked_entities: entities,
        has_parts: sortedChildItems,
        order: sortedChildItems[0].order,
        suppress_display: sortedChildItems.find((it) =>
            it.suppress_display === true
          )
          ? true
          : false,
      });
    }
  }
  // throw "Not yet implemented";
  return newItems;
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

  if (stubRecord) {
    return Object.fromEntries(Object.entries(stubRecord).filter(([_, v]) => v));
  } else {
    console.warn(`No web item could be created from airtable record ${rec.id}`);
  }
}

export function reshape(recordMap: Map<string, AirtableRecord[]>): WebItem[] {
  const itemsData = recordMap.get("Items");
  const compositesData = recordMap.get("Composite_Objects");
  const subjectsData = recordMap.get("Subjects");
  const entitiesData = recordMap.get("Entities");

  if (!itemsData) {
    throw new Error("No Items data found.");
  } else {
    const partialWebItems =
      (itemsData.map(processRecord) as unknown) as WebItem[];

    // Some items have multiple parts, so we need to combine them
    const singletons = partialWebItems.filter((it) => !it.parent);
    let composites: WebItem[] = [];
    const multiPartItems = partialWebItems.filter((pItem) => pItem.parent);
    if (multiPartItems && multiPartItems.length > 0) {
      composites = handleMultiPartItems(multiPartItems, compositesData);
    }

    const itemsSingleAndMultiple = [
      ...singletons,
      ...composites,
    ];

    // Now we need to convert the subjects from ids to strings
    itemsSingleAndMultiple.map((it) => {
      if (it.linked_subjects && it.linked_subjects.length > 0) {
        const mappedSubjects = it.linked_subjects.map((subjectId) => {
          return convertIdToName(subjectId, subjectsData);
        }).filter(Boolean);
        if (mappedSubjects.length > 0) {
          it.linked_subjects = mappedSubjects as string[];
        } else {
          delete it.linked_subjects;
        }
      }
    });

    // … and the entities
    itemsSingleAndMultiple.map((it) => {
      if (it.linked_entities && it.linked_entities.length > 0) {
        const mappedEntities = it.linked_entities.map((entityId) => {
          return convertIdToName(entityId, entitiesData);
        }).filter(Boolean);
        if (mappedEntities.length > 0) {
          it.linked_entities = mappedEntities as string[];
        } else {
          delete it.linked_entities;
        }
      }
    });

    return itemsSingleAndMultiple;
  }
}
