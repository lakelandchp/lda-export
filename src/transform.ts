import { AirtableRecord } from "./airtable.ts";

type Attachment = {
  id: string;
  filename: string;
  max_size?: number;
  mimetype?: string;
  versions?: Record<ImageVersionAllowedKeys, Image>;
};

type ImageVersionAllowedKeys = "small" | "large" | "full" | "original";

type Image = {
  url: string;
  width: number;
  height: number;
};

type ProjectsAllowedKeys = "book" | "tour" | "video";

type BookInfo = {
  page: number;
  chapter: string;
};

// These are stubs for now
type TourInfo = Record<never, never>;
type VideoInfo = Record<never, never>;

type WebItem = {
  id: string;
  airtable_record_id: string;
  title: string;
  description: string;
  asset?: Attachment;
  type: string;
  order: number;
  suppress_display: boolean;
  projects?: Record<ProjectsAllowedKeys, BookInfo | TourInfo | VideoInfo>;
};

function reshape(records: Map<string, AirtableRecord[]>): WebItem[] {}
