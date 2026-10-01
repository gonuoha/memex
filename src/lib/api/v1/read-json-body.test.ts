import { describe, expect, it } from "vitest";

import { API_V1_MAX_BODY_BYTES, readApiV1JsonBody } from "./read-json-body";

function jsonRequest(body: string): Request {
  return new Request("https://memex.test/api/v1/items", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-length": String(new TextEncoder().encode(body).byteLength),
    },
    body,
  });
}

describe("readApiV1JsonBody", () => {
  it("rejects bodies larger than the byte cap even without Content-Length", async () => {
    const oversized = "a".repeat(API_V1_MAX_BODY_BYTES + 1);

    const request = new Request("https://memex.test/api/v1/items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: oversized,
    });

    const result = await readApiV1JsonBody(request);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(413);
    }
  });

  it("parses valid JSON within the cap", async () => {
    const result = await readApiV1JsonBody(jsonRequest('{"title":"Hi"}'));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ title: "Hi" });
    }
  });
});
