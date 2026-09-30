import { describe, expect, it } from "vitest";

import {
  buildContainsLikePattern,
  buildPrefixTsQuery,
  getHighlightTerms,
  getSearchTerms,
  getTypeNameCandidates,
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
    expect(buildPrefixTsQuery(":*&|!()<->'\\\"_")).toBeNull();
  });

  it.each([
    ["a'b\\c:*&|!()<->", "a:* & b:* & c:*"],
    ["foo_bar", "foo:* & bar:*"],
    ["café naïve", "café:* & naïve:*"],
    ["日本語 テスト", "日本語:* & テスト:*"],
    ["React REACT react", "react:*"],
  ])("only emits letter/digit terms for %j", (input, expected) => {
    const tsQuery = buildPrefixTsQuery(input);

    expect(tsQuery).toBe(expected);
    expect(tsQuery).toMatch(/^[\p{L}\p{N}]+:\*( & [\p{L}\p{N}]+:\*)*$/u);
  });

  it("caps the number of terms", () => {
    const tsQuery = buildPrefixTsQuery("a b c d e f g h i j k");

    expect(tsQuery?.split(" & ")).toHaveLength(8);
  });
});

describe("parseSearchQuery tags", () => {
  it("accepts tags with punctuation used in tag names", () => {
    expect(parseSearchQuery("tag:node.js hooks").tag).toBe("node.js");
    expect(parseSearchQuery("#C++").tag).toBe("c++");
  });

  it("treats a bare prefix as text", () => {
    expect(parseSearchQuery("tag: react")).toEqual({
      text: "tag: react",
      typeSlug: null,
      tag: null,
    });
  });
});

describe("getTypeNameCandidates", () => {
  it("maps plurals and aliases to singular type names", () => {
    expect(getTypeNameCandidates("snippets")).toEqual(["snippets", "snippet"]);
    expect(getTypeNameCandidates("url")).toEqual(["url", "link"]);
    expect(getTypeNameCandidates("URLs")).toEqual(["urls", "link", "url"]);
    expect(getTypeNameCandidates("links")).toEqual(["links", "link"]);
  });

  it("keeps the exact slug first for custom types", () => {
    expect(getTypeNameCandidates("note")).toEqual(["note"]);
  });
});

describe("buildContainsLikePattern", () => {
  it("escapes LIKE wildcards and the escape character", () => {
    expect(buildContainsLikePattern("100%_done\\")).toBe("%100\\%\\_done\\\\%");
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
