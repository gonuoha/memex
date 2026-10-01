import { apiV1Error } from "@/lib/api/v1/response";

export const API_V1_MAX_BODY_BYTES = 512 * 1024;

function isJsonContentType(request: Request): boolean {
  const contentType = request.headers.get("content-type");

  if (!contentType) {
    return false;
  }

  const mediaType = contentType.split(";")[0]?.trim().toLowerCase();

  return mediaType === "application/json";
}

async function readBodyBytesWithLimit(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; tooLarge: boolean }> {
  if (!request.body) {
    return { ok: true, bytes: new Uint8Array() };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    received += value.byteLength;

    if (received > maxBytes) {
      return { ok: false, tooLarge: true };
    }

    chunks.push(value);
  }

  const bytes = new Uint8Array(received);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, bytes };
}

export type ApiV1JsonBodyResult =
  | { ok: true; data: unknown; raw: Record<string, unknown> }
  | { ok: false; response: Response };

export async function readApiV1JsonBody(
  request: Request,
): Promise<ApiV1JsonBodyResult> {
  if (!isJsonContentType(request)) {
    return {
      ok: false,
      response: apiV1Error(
        "validation_error",
        "Content-Type must be application/json",
        415,
      ),
    };
  }

  const body = await readBodyBytesWithLimit(request, API_V1_MAX_BODY_BYTES);

  if (!body.ok) {
    return {
      ok: false,
      response: apiV1Error(
        "validation_error",
        "Request body is too large",
        413,
      ),
    };
  }

  if (body.bytes.byteLength === 0) {
    return {
      ok: false,
      response: apiV1Error("validation_error", "Invalid JSON body", 422),
    };
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(body.bytes);
    const data: unknown = JSON.parse(text);
    const raw =
      data !== null && typeof data === "object" && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {};

    return { ok: true, data, raw };
  } catch {
    return {
      ok: false,
      response: apiV1Error("validation_error", "Invalid JSON body", 422),
    };
  }
}
