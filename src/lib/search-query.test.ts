import { describe, expect, it } from "vitest";

import {
  buildPrefixTsQuery,
  getHighlightTerms,
  getSearchTerms,
  parseSearchQuery,
} from "./search-query";

describe("parseSearchQuery", () => {
  it("parses type and tag prefixes and free text", () => {
    expect(parseSearchQuery("type:snippet react hooks")).toEqual({
      text: "react hooks",
      typeSlug: "snippet",
      tag: null,
    });
  });

  it("parses tag: and hash tags", () => {
    expect(parseSearchQuery("tag:react")).toEqual({
      text: "",
      typeSlug: null,
      tag: "react",
    });

    expect(parseSearchQuery("#react")).toEqual({
      text: "",
      typeSlug: null,
      tag: "react",
    });
  });

  it("normalizes type slug to lowercase", () => {
    expect(parseSearchQuery("type:Prompt hello")).toEqual({
      text: "hello",
      typeSlug: "prompt",
      tag: null,
    });
  });
});

describe("buildPrefixTsQuery", () => {
  it("joins sanitized terms with prefix operators", () => {
    expect(buildPrefixTsQuery("react hooks")).toBe("react:* & hooks:*");
  });

  it("drops unsafe tokens", () => {
    expect(buildPrefixTsQuery("foo;drop bar")).toBe("foo:* & drop:* & bar:*");
    expect(getSearchTerms("foo;drop bar")).toEqual(["foo", "drop", "bar"]);
  });

  it("returns null when no valid terms", () => {
    expect(buildPrefixTsQuery("   ")).toBeNull();
    expect(buildPrefixTsQuery("!!!")).toBeNull();
  });
});

describe("getHighlightTerms", () => {
  it("includes text terms and tag", () => {
    expect(getHighlightTerms(parseSearchQuery("react tag:vue"))).toEqual([
      "react",
      "vue",
    ]);
  });
});
