import { cache } from "react";

import { getPublicSharedItemByToken } from "@/lib/db/share-links";

export const getCachedPublicSharedItemByToken = cache(
  getPublicSharedItemByToken,
);
