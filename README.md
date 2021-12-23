# Lakeland Digital Archive (LDA) Export

Export Airtable data to files on disk. Inspired by
[`airtable-export`](https://github.com/simonw/airtable-export)

## Usage

You will need the following information:

- Your Airtable base ID - this is a string starting with `app...`
- Your Airtable API key - this is a string starting with `key...`

Export data by running

```
deno run \ 
--allow-env=AIRTABLE_BASE_ID,AIRTABLE_API_KEY \
--allow-net=api.airtable.com \
--allow-write=./public \
./src/app.ts
```

Destination for data export can be configured by passing a path at runtime.

The script is also configured so that it can be run from within VSCode using the
Command Palette (Command + Shift + P). Select `Tasks: Run Task` then
`deno: run`.
