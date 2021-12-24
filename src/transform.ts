import { yellow } from "https://deno.land/std@0.119.0/fmt/colors.ts";
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

// function reshape(recordMap: Map<string, AirtableRecord[]>): WebItem[] {
export function reshape(recordMap: Map<string, AirtableRecord[]>): void {
  if (!recordMap.get("Items")) {
    throw new Error(
      `Items table is required. Please re-run with ${
        yellow('"Items"')
      } in table list.`,
    );
  } else {
    // const itemData = recordMap.get("Items");
  }
}
