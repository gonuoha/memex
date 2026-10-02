import { describe, expect, it } from "vitest";

import { createItemTypeSchema } from "@/lib/validations/item-types";

describe("createItemTypeSchema", () => {
  it("accepts a valid custom type payload", () => {
    const parsed = createItemTypeSchema.safeParse({
      name: "Runbooks",
      kind: "markdown",
      icon: "BookOpen",
      color: "#6366F1",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects reserved system names", () => {
    const parsed = createItemTypeSchema.safeParse({
      name: "snippet",
      kind: "code",
      icon: "Code",
      color: "#6366F1",
    });

    expect(parsed.success).toBe(false);
  });
});
