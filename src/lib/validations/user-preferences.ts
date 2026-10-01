import { z } from "zod";

import {
  APPEARANCES,
  ITEMS_VIEWS,
  TYPE_COLOR_POSITIONS,
} from "@/lib/user-preferences";

export const userPreferencesSchema = z.object({
  showOverview: z.boolean(),
  typeColorPosition: z.enum(TYPE_COLOR_POSITIONS),
  appearance: z.enum(APPEARANCES),
  itemsView: z.enum(ITEMS_VIEWS).optional(),
  showLinkFavicons: z.boolean().optional(),
  onboardingDismissed: z.boolean().optional(),
});
