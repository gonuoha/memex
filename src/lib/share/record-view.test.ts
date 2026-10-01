import { describe, expect, it } from "vitest";

import { shouldRecordShareLinkView } from "./record-view";

describe("shouldRecordShareLinkView", () => {
  it("skips HEAD requests", () => {
    expect(shouldRecordShareLinkView("HEAD", "Mozilla/5.0")).toBe(false);
  });

  it("skips known unfurlers", () => {
    expect(shouldRecordShareLinkView("GET", "Slackbot-LinkExpanding 1.0")).toBe(
      false,
    );
    expect(shouldRecordShareLinkView("GET", "Twitterbot/1.0")).toBe(false);
  });

  it("records normal browser views", () => {
    expect(
      shouldRecordShareLinkView(
        "GET",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
      ),
    ).toBe(true);
  });
});
