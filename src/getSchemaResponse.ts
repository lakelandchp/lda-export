import { walk } from "std/fs";
import { join, dirname, fromFileUrl } from "std/path";

const projectRoot = dirname(fromFileUrl(import.meta.url));

const schemaFilePath =
  Deno.env.get("SCHEMA_DIR") || "../tests/fixtures/responses";
const schemaDir = join(projectRoot, schemaFilePath);
console.log("🪚 schemaDir:", schemaDir);

export async function getAndImportLatestSchemaResponse() {
  const files: { path: string; mtime: Date | null }[] = [];

  const schemaRegex = /^schema_response.*\.json$/;

  console.log("📁 Directory contents:");
  try {
    for await (const entry of Deno.readDir(schemaDir)) {
      console.log(`  ${entry.isDirectory ? "📂" : "📄"} ${entry.name}`);
    }
  } catch (error) {
    console.error("❌ Error reading directory:", error);
    throw error;
  }

  try {
    for await (const entry of walk(schemaDir)) {
      if (schemaRegex.test(entry.name)) {
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

  console.log(`📊 Total matching schema files found: ${files.length}`);

  files.sort((a, b) => {
    if (!a.mtime || !b.mtime) return 0;
    return b.mtime.getTime() - a.mtime.getTime();
  });

  const mostRecentFile = files[0].path;
  console.log(`Reading most recent schema file: ${mostRecentFile}`);

  const jsonContent = await Deno.readTextFile(mostRecentFile);

  try {
    const jsonData = JSON.parse(jsonContent);
    return jsonData;
  } catch (error) {
    throw new Error(
      `Failed to parse JSON from ${mostRecentFile}: ${error.message}`,
    );
  }
}
