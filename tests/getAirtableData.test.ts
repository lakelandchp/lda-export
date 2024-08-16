import { describe, it, beforeEach, afterEach } from "@std/testing/bdd";
import { assertEquals, assertExists } from "@std/assert";
import { createFetchStubImplementation } from "./mocks/fetchStub.ts";
import { getAirtableData } from "../src/main.ts";
import { itemData as mockItemData } from "./fixtures/index.ts";
import {
  stub,
  assertSpyCalls,
  type Stub,
  assertSpyCall,
} from "@std/testing/mock";

describe("getAirtableData tests", () => {
  const baseId = "app1234";
  const tables = ["Items"];
  const apiKey = "apikey1234";
  const httpReadTimeout = 60;
  let fetchStub: Stub;
  beforeEach(() => {
    fetchStub = stub(globalThis, "fetch", createFetchStubImplementation());
  });

  afterEach(() => {
    fetchStub.restore();
  });

  it("should return a map of tables and records", async () => {
    const airtableData = await getAirtableData(
      baseId,
      tables,
      apiKey,
      httpReadTimeout,
      fetchStub as unknown as typeof fetch,
      console,
    );

    assertEquals(airtableData.size, 1);
    assertExists(airtableData.get("Items"));

    const itemsData = airtableData.get("Items");
    assertExists(itemsData);
    assertEquals(itemsData.length, mockItemData.records.length);

    assertEquals(itemsData[0], mockItemData.records[0]);
  });

  it("should handle pagination correctly", async () => {
    const _airtableData = await getAirtableData(
      baseId,
      tables,
      apiKey,
      httpReadTimeout,
      fetchStub as unknown as typeof fetch,
      console,
    );

    assertSpyCalls(fetchStub, 2);
  });
});
