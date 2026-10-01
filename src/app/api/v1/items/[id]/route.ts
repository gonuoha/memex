import { deleteItem, getItemById } from "@/lib/db/items";
import { validateUserCollectionIds } from "@/lib/db/collections";
import { patchApiV1Item } from "@/lib/db/api-v1-patch";
import { apiV1Error, apiV1Json } from "@/lib/api/v1/response";
import { readApiV1JsonBody } from "@/lib/api/v1/request";
import { revalidateAppAfterItemMutation } from "@/lib/api/v1/revalidate-app";
import { serializeApiV1Item } from "@/lib/api/v1/serialize";
import { withApiAuth } from "@/lib/api/v1/with-api-auth";
import {
  apiV1UpdateItemSchema,
  formatZodValidationDetails,
} from "@/lib/validations/api-v1";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const GET = withApiAuth<RouteContext>(async (_request, auth, context) => {
  const { id } = await context.params;
  const item = await getItemById(auth.userId, id);

  if (!item) {
    return apiV1Error("not_found", "Item not found", 404);
  }

  return apiV1Json({ item: serializeApiV1Item(item) });
});

export const PATCH = withApiAuth<RouteContext>(async (request, auth, context) => {
  const { id } = await context.params;
  const bodyResult = await readApiV1JsonBody(request);

  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const parsed = apiV1UpdateItemSchema.safeParse(bodyResult.data);

  if (!parsed.success) {
    return apiV1Error(
      "validation_error",
      "Invalid request body",
      422,
      { details: formatZodValidationDetails(parsed.error) },
    );
  }

  if (parsed.data.collectionIds !== undefined) {
    const hasValidCollections = await validateUserCollectionIds(
      auth.userId,
      parsed.data.collectionIds,
    );

    if (!hasValidCollections) {
      return apiV1Error("validation_error", "Invalid collection selection", 422, {
        details: [{ path: "collectionIds", message: "Invalid collection selection" }],
      });
    }
  }

  const patched = await patchApiV1Item(
    auth.userId,
    id,
    parsed.data,
    bodyResult.raw,
  );

  if (!patched.ok) {
    if (patched.code === "not_found") {
      return apiV1Error("not_found", "Item not found", 404);
    }

    return apiV1Error("validation_error", patched.message, 422, {
      details: [{ path: patched.path, message: patched.message }],
    });
  }

  revalidateAppAfterItemMutation();

  return apiV1Json({ item: serializeApiV1Item(patched.item) });
});

export const DELETE = withApiAuth<RouteContext>(async (_request, auth, context) => {
  const { id } = await context.params;
  const deleted = await deleteItem(auth.userId, id);

  if (!deleted) {
    return apiV1Error("not_found", "Item not found", 404);
  }

  revalidateAppAfterItemMutation();

  return apiV1Json({ success: true });
});
