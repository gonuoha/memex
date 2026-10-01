import { listApiV1Collections } from "@/lib/db/api-v1-catalog";
import { apiV1Json } from "@/lib/api/v1/response";
import { withApiAuth } from "@/lib/api/v1/with-api-auth";

export const GET = withApiAuth(async (_request, auth) => {
  const collections = await listApiV1Collections(auth.userId);

  return apiV1Json({ collections });
});
