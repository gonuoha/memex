export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const MAX_IMPORT_READ_BYTES = MAX_IMPORT_BYTES + 64 * 1024;

const ALLOWED_SEC_FETCH_SITE = new Set(["same-origin", "none"]);

export type ImportBodyTooLargeError = { kind: "too_large" };
export type ImportSecFetchDeniedError = { kind: "sec_fetch_denied" };

export function validateImportSecFetchSite(
  secFetchSite: string | null,
): ImportSecFetchDeniedError | null {
  if (!secFetchSite) {
    return null;
  }

  const normalized = secFetchSite.toLowerCase();

  if (!ALLOWED_SEC_FETCH_SITE.has(normalized)) {
    return { kind: "sec_fetch_denied" };
  }

  return null;
}

export async function readRequestBodyWithLimit(
  request: Request,
  maxBytes: number = MAX_IMPORT_READ_BYTES,
): Promise<ArrayBuffer | ImportBodyTooLargeError> {
  const body = request.body;

  if (!body) {
    return new ArrayBuffer(0);
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    if (!value) {
      continue;
    }

    total += value.byteLength;

    if (total > maxBytes) {
      await reader.cancel();
      return { kind: "too_large" };
    }

    chunks.push(value);
  }

  const buffer = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return buffer.buffer;
}

export async function readImportMultipartFile(
  request: Request,
): Promise<
  | { file: File }
  | ImportBodyTooLargeError
  | ImportSecFetchDeniedError
  | { kind: "missing_file" }
> {
  const secFetchError = validateImportSecFetchSite(
    request.headers.get("sec-fetch-site"),
  );

  if (secFetchError) {
    return secFetchError;
  }

  const buffer = await readRequestBodyWithLimit(request);

  if (typeof buffer === "object" && "kind" in buffer) {
    return buffer;
  }

  const contentType = request.headers.get("content-type");

  const formData = await new Request("http://memex.local/import", {
    method: "POST",
    headers: contentType ? { "content-type": contentType } : undefined,
    body: buffer,
  }).formData();

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return { kind: "missing_file" };
  }

  if (file.size > MAX_IMPORT_BYTES) {
    return { kind: "too_large" };
  }

  return { file };
}
