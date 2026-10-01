import { listApiV1Items } from "@/lib/db/api-v1-items";
import { executeCreateTextItem } from "@/lib/items/execute-create-item";
import { apiV1Error, apiV1Json } from "@/lib/api/v1/response";
import { readApiV1JsonBody } from "@/lib/api/v1/request";
import { revalidateAppAfterItemMutation } from "@/lib/api/v1/revalidate-app";
import { serializeApiV1Item, serializeApiV1Items } from "@/lib/api/v1/serialize";
import { withApiAuth } from "@/lib/api/v1/with-api-auth";
import {
  apiV1CreateItemSchema,
  formatZodValidationDetails,
  parseApiV1ListItemsQuery,
} from "@/lib/validations/api-v1";

export const GET = withApiAuth(async (request, auth) => {
  const parsed = parseApiV1ListItemsQuery(new URL(request.url).searchParams);

  if (!parsed.success) {
    return apiV1Error(
      "validation_error",
      "Invalid query parameters",
      400,
      { details: formatZodValidationDetails(parsed.error) },
    );
  }

  const listed = await listApiV1Items(auth.userId, parsed.data);

  if (!listed.ok) {
    return apiV1Error("invalid_cursor", "Invalid cursor", 400);
  }

  return apiV1Json({
    items: serializeApiV1Items(listed.page.items),
    nextCursor: listed.page.nextCursor,
  });
});

export const POST = withApiAuth(async (request, auth) => {
  const bodyResult = await readApiV1JsonBody(request);

  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const parsed = apiV1CreateItemSchema.safeParse(bodyResult.data);

  if (!parsed.success) {
    return apiV1Error(
      "validation_error",
      "Invalid request body",
      422,
      { details: formatZodValidationDetails(parsed.error) },
    );
  }

  const result = await executeCreateTextItem(auth.userId, parsed.data);

  if (!result.success) {
    const status = result.kind === "item_limit" ? 409 : 422;
    const code = result.kind === "item_limit" ? "conflict" : "validation_error";

    return apiV1Error(code, result.message, status);
  }

  revalidateAppAfterItemMutation();

  return apiV1Json({ item: serializeApiV1Item(result.data) }, { status: 201 });
});
