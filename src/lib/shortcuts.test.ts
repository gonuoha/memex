import { describe, expect, it } from "vitest";

import {
  INITIAL_SEQUENCE_STATE,
  SHORTCUT_SEQUENCE_TIMEOUT_MS,
  matchSearchShortcut,
  resolveShortcutAction,
} from "@/lib/shortcuts";

describe("matchSearchShortcut", () => {
  it("matches cmd+k and ctrl+k", () => {
    expect(
      matchSearchShortcut({
        key: "k",
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      }),
    ).toBe(true);

    expect(
      matchSearchShortcut({
        key: "k",
        metaKey: false,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
      }),
    ).toBe(true);
  });

  it("ignores k with shift or alt", () => {
    expect(
      matchSearchShortcut({
        key: "k",
        metaKey: true,
        ctrlKey: false,
        shiftKey: true,
        altKey: false,
      }),
    ).toBe(false);
  });
});

describe("resolveShortcutAction", () => {
  const now = 1_000;
  const noModifiers = {
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
  };

  it("opens search on slash", () => {
    const result = resolveShortcutAction(
      INITIAL_SEQUENCE_STATE,
      {
        key: "/",
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      },
      now,
    );

    expect(result.action).toEqual({ type: "open_search" });
  });

  it("handles g then d navigation chord", () => {
    const afterG = resolveShortcutAction(
      INITIAL_SEQUENCE_STATE,
      {
        key: "g",
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      },
      now,
    );

    expect(afterG.state.prefix).toBe("g");

    const afterD = resolveShortcutAction(
      afterG.state,
      {
        key: "d",
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      },
      now + 100,
    );

    expect(afterD.action).toEqual({ type: "navigate", href: "/dashboard" });
    expect(afterD.state).toEqual(INITIAL_SEQUENCE_STATE);
  });

  it("expires g-prefix sequences after timeout", () => {
    const afterG = resolveShortcutAction(
      INITIAL_SEQUENCE_STATE,
      {
        key: "g",
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      },
      now,
    );

    const afterD = resolveShortcutAction(
      afterG.state,
      {
        key: "d",
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      },
      now + SHORTCUT_SEQUENCE_TIMEOUT_MS + 1,
    );

    expect(afterD.action).toBeUndefined();
  });

  it("maps g+1 to the first sidebar item type", () => {
    const afterG = resolveShortcutAction(
      INITIAL_SEQUENCE_STATE,
      {
        key: "g",
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      },
      now,
    );

    const afterOne = resolveShortcutAction(
      afterG.state,
      {
        key: "1",
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      },
      now + 50,
    );

    expect(afterOne.action).toEqual({
      type: "navigate_item_type",
      itemType: "snippet",
    });
  });

  it("distinguishes new item and new collection shortcuts", () => {
    const newItem = resolveShortcutAction(
      INITIAL_SEQUENCE_STATE,
      {
        key: "c",
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      },
      now,
    );

    expect(newItem.action).toEqual({ type: "new_item" });

    const newCollection = resolveShortcutAction(
      INITIAL_SEQUENCE_STATE,
      {
        key: "c",
        metaKey: false,
        ctrlKey: false,
        shiftKey: true,
        altKey: false,
      },
      now,
    );

    expect(newCollection.action).toEqual({ type: "new_collection" });

    const newCollectionUppercase = resolveShortcutAction(
      INITIAL_SEQUENCE_STATE,
      { ...noModifiers, key: "C", shiftKey: true },
      now,
    );

    expect(newCollectionUppercase.action).toEqual({ type: "new_collection" });
  });

  it("opens shortcuts help on shift+/ (?)", () => {
    const result = resolveShortcutAction(
      INITIAL_SEQUENCE_STATE,
      { ...noModifiers, key: "?", shiftKey: true },
      now,
    );

    expect(result.action).toEqual({ type: "open_shortcuts_help" });
  });

  it("navigates to collections on g then c instead of creating an item", () => {
    const afterG = resolveShortcutAction(
      INITIAL_SEQUENCE_STATE,
      { ...noModifiers, key: "g" },
      now,
    );
    const afterC = resolveShortcutAction(
      afterG.state,
      { ...noModifiers, key: "c" },
      now + 50,
    );

    expect(afterC.action).toEqual({ type: "navigate", href: "/collections" });
  });

  it("leaves browser shortcuts with cmd/ctrl untouched", () => {
    expect(
      resolveShortcutAction(
        INITIAL_SEQUENCE_STATE,
        { ...noModifiers, key: "[", metaKey: true },
        now,
      ).action,
    ).toBeUndefined();

    expect(
      resolveShortcutAction(
        INITIAL_SEQUENCE_STATE,
        { ...noModifiers, key: "c", ctrlKey: true },
        now,
      ).action,
    ).toBeUndefined();

    const afterG = resolveShortcutAction(
      INITIAL_SEQUENCE_STATE,
      { ...noModifiers, key: "g" },
      now,
    );

    expect(
      resolveShortcutAction(
        afterG.state,
        { ...noModifiers, key: "d", metaKey: true },
        now + 50,
      ).action,
    ).toBeUndefined();
  });
});
