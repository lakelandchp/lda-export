import { walk } from "std/fs";
import { resolvePath } from "./pathUtils.ts";

const defaultSearchDir =
  Deno.env.get("DATA_DIR") || resolvePath("dist", "data", "raw");

async function getDataFiles(
  fileName: string | RegExp,
  targetDir: string = defaultSearchDir,
  sort?: "asc" | "desc",
) {
  const files: { path: string; mtime: Date | null }[] = [];

  if (typeof fileName === "string") {
    throw new Error("Not implemented");
  }

  if (!targetDir || !(await Deno.stat(targetDir)).isDirectory) {
    throw new Error(`Target directory ${targetDir} does not exist`);
  }

  try {
    for await (const entry of walk(targetDir)) {
      if (fileName.test(entry.name)) {
        if (entry.isFile) {
          const fileInfo = await Deno.stat(entry.path);
          files.push({ path: entry.path, mtime: fileInfo.mtime });
        }
      }
    }
  } catch (error) {
    console.error("❌ Error walking directory:", error);
    throw error;
  }

  if (sort) {
    files.sort((a, b) => {
      if (!a.mtime || !b.mtime) return 0;
      if (sort === "asc") {
        return a.mtime.getTime() - b.mtime.getTime();
      } else if (sort === "desc") {
        return b.mtime.getTime() - a.mtime.getTime();
      }

      return b.mtime.getTime() - a.mtime.getTime();
    });
  }

  return files;
}

async function loadDataFile(filePath: string) {
  const jsonContent = await Deno.readTextFile(filePath);
  try {
    const jsonData = JSON.parse(jsonContent);
    return jsonData;
  } catch (error) {
    throw new Error(`Failed to parse JSON from ${filePath}: ${error.message}`);
  }
}

export async function getLatestFile(
  fileName: string | RegExp,
  targetDir?: string,
) {
  const files = await getDataFiles(fileName, targetDir);

  if (files.length === 0) {
    throw new Error(`No files found matching ${fileName}`);
  }

  const mostRecentFile = files[0].path;
  console.log(`Reading most recent file: ${mostRecentFile}`);

  return loadDataFile(mostRecentFile);
}
