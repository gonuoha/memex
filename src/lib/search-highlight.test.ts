import { describe, expect, it } from "vitest";

import { splitHighlightParts } from "./search-highlight";

describe("splitHighlightParts", () => {
  it("highlights case-insensitive matches and keeps original casing", () => {
    expect(splitHighlightParts("React hooks in react", ["react"])).toEqual([
      { text: "React", highlight: true },
      { text: " hooks in ", highlight: false },
      { text: "react", highlight: true },
    ]);
  });

  it("treats regex metacharacters in terms literally", () => {
    expect(splitHighlightParts("use c++ or (a.b)", ["c++", "(a.b)"])).toEqual([
      { text: "use ", highlight: false },
      { text: "c++", highlight: true },
      { text: " or ", highlight: false },
      { text: "(a.b)", highlight: true },
    ]);
  });

  it("prefers the longest overlapping term", () => {
    expect(splitHighlightParts("hooks", ["hook", "hooks"])).toEqual([
      { text: "hooks", highlight: true },
    ]);
  });

  it("keeps offsets aligned when case folding changes string length", () => {
    const parts = splitHighlightParts("İstanbul guide", ["guide"]);

    expect(parts.map((part) => part.text).join("")).toBe("İstanbul guide");
    expect(parts.at(-1)).toEqual({ text: "guide", highlight: true });
  });

  it("returns the whole value when there are no terms or matches", () => {
    expect(splitHighlightParts("hello", [])).toEqual([
      { text: "hello", highlight: false },
    ]);
    expect(splitHighlightParts("hello", ["xyz"])).toEqual([
      { text: "hello", highlight: false },
    ]);
  });
});
