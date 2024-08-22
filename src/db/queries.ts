export const getItemQuery = "SELECT * FROM Items where airtableId = ?";

export const getItemFromOperationQuery =
  "SELECT recordSnapshot FROM operations WHERE airtableId = ?";
