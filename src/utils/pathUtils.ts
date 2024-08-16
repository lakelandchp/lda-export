import { dirname, fromFileUrl, join } from "std/path";

const BASE_DIR = dirname(fromFileUrl(import.meta.url));

const PROJECT_ROOT = join(BASE_DIR, "..", "..");
export function resolvePath(...paths: string[]): string {
  return join(PROJECT_ROOT, ...paths);
}
