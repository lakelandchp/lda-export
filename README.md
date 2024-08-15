# Lakeland Digital Archive (LDA) Export

Export Airtable data to files on disk. Inspired by
[`airtable-export`](https://github.com/simonw/airtable-export)

## Usage

You will need the following information:

- Your Airtable base ID - this is a string starting with `app...`
- A valid Airtable Personal Access Token - this is a string starting with `pat...`

To run the backup script you can do:
`deno task run`

Additional flags can be passed in after `main.ts`:

- To configure the directory for data export: `--outputDir=DIRNAME`

By default, this script will save results to `dist`.
