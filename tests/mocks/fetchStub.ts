import { itemData } from "../fixtures/index.ts";

type APIResponse = {
  records: Record<string, unknown>[];
  offset?: string;
};

const mockData: Map<string, APIResponse> = new Map([["Items_GET", itemData]]);

export function createFetchStubImplementation() {
  return (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    const parsedUrl = new URL(url);
    const pathParts = parsedUrl.pathname.split("/");
    const tableName = pathParts[pathParts.length - 1];
    const offset = parsedUrl.searchParams.get("offset");
    let key = `${tableName}_${init?.method || "GET"}`;
    if (offset) {
      key += `_${offset}`;
    }

    const responseData = mockData.get(key);

    if (responseData) {
      const offsetMatch = url.match(/offset=([^&]*)/);
      const offset = offsetMatch ? offsetMatch[1] : undefined;

      let response = { ...responseData };

      if (offset && offset === response.offset) {
        response = { records: [] };
      }

      return Promise.resolve(
        new Response(JSON.stringify(response), { status: 200 }),
      );
    } else if (offset) {
      // If there's an offset but no data, return an empty response to end the test loop
      return Promise.resolve(
        new Response(JSON.stringify({ records: [] }), { status: 200 }),
      );
    }
    return Promise.resolve(new Response(null, { status: 500 }));
  };
}
