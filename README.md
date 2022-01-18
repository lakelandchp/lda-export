# Lakeland Digital Archive (LDA) Export

Export Airtable data to files on disk. Inspired by
[`airtable-export`](https://github.com/simonw/airtable-export)

## Usage

You will need the following information:

- Your Airtable base ID - this is a string starting with `app...`
- Your Airtable API key - this is a string starting with `key...`

This repository includes a `tasks.json` file so that it can be run from within
VSCode using the Command Palette (Command + Shift + P). Select `Tasks: Run Task`
then `deno: run` or `deno: compile`.

If you want to run directly from the command line, you would invoke:

```
deno run \ 
--allow-env=AIRTABLE_BASE_ID,AIRTABLE_API_KEY \
--allow-net=api.airtable.com \
--allow-read=. \
--allow-write=. \
./src/main.ts
```

Additional flags can be passed in after `main.ts`:

- To configure the directory for data export: `--outputDir=DIRNAME`
- To export data from all tables: `--backup`

By default, this script will save results to `dist`. When compiled, this project
emits a binary named `lda-export`
