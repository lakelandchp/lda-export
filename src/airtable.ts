type AirtableAPIAllowedKeys =
  | "createdTime"
  | "id"
  | "fields";

type AirtableRecord = Record<AirtableAPIAllowedKeys, unknown>;

type AttachmentAllowedKeys =
  | "id"
  | "filename"
  | "url"
  | "thumbnails"
  | "width"
  | "height"
  | "type"
  | "size";

type AirtableAttachment = Record<AttachmentAllowedKeys, unknown>;
