import type { Metadata } from "next";

import {
  LegalPage,
  LegalSection,
} from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "REST API",
  description: "Memex REST API v1 reference for Pro subscribers.",
};

export default function ApiDocsPage() {
  return (
    <LegalPage title="Memex REST API (v1)" documentName="API reference">
      <LegalSection title="Authentication">
        <p>
          Send a personal API key as a Bearer token. Keys are created in Settings
          (Pro required to create new keys).
        </p>
        <pre className="overflow-x-auto rounded-lg bg-muted px-4 py-3 text-xs text-foreground">
{`Authorization: Bearer mx_your_api_key_here`}
        </pre>
        <p>
          Keys use the format <code>mx_</code> followed by 43 base64url characters.
          Changing your password or completing a password reset revokes all API keys.
        </p>
      </LegalSection>

      <LegalSection title="Base URL & CORS">
        <p>
          Use your deployment origin with the <code>/api/v1</code> prefix (for
          example <code>https://app.example.com/api/v1</code>). The API is
          intended for server-to-server use; CORS is not enabled for browser
          cross-origin calls.
        </p>
      </LegalSection>

      <LegalSection title="Rate limits">
        <p>
          Each API key is limited to 120 requests per minute. Responses include
          <code>X-RateLimit-Limit</code>, <code>X-RateLimit-Remaining</code>,
          and <code>X-RateLimit-Reset</code>. When limited, the API returns
          <code>429</code> with <code>Retry-After</code> (seconds). Failed
          authentication attempts are also rate limited per IP.
        </p>
      </LegalSection>

      <LegalSection title="Request bodies">
        <p>
          JSON request bodies are limited to 512 KB. The server enforces this
          limit while reading the body stream (not only via
          <code>Content-Length</code>).
        </p>
      </LegalSection>

      <LegalSection title="Errors">
        <p>
          Query parameter problems return <code>400</code> with
          <code>validation_error</code> or <code>invalid_cursor</code>. JSON body
          problems return <code>422</code> with optional
          <code>details: [{`{ path, message }`}]</code>.
        </p>
        <pre className="overflow-x-auto rounded-lg bg-muted px-4 py-3 text-xs text-foreground">
{`{
  "error": {
    "code": "validation_error",
    "message": "Human-readable message",
    "details": [{ "path": "title", "message": "Title is required" }]
  }
}`}
        </pre>
        <p>
          Status codes: 400, 401, 403, 404, 413, 415, 422, 429, 500.
          <code>409 conflict</code> is reserved for plan or quota limits on
          create (for example item count), not for PATCH concurrency.
        </p>
      </LegalSection>

      <LegalSection title="List items">
        <p className="font-medium text-foreground">GET /api/v1/items</p>
        <p>
          Returns <code>{`{ "items": [...], "nextCursor": string | null }`}</code>.
          Filters: <code>type</code> (system type aliases such as
          <code>snippet</code> or <code>notes</code>, or your custom type
          <strong> slug</strong>), <code>tag</code>, <code>collection</code>,
          <code>q</code> (full-text), <code>limit</code> (default 25, max 100),
          <code>cursor</code>. Unknown <code>type</code> values return
          <code>400</code> with <code>validation_error</code> (including custom
          slugs that do not belong to your account).
        </p>
        <p>
          Without <code>q</code>, pagination uses keyset cursors ordered by
          <code>updatedAt</code> then <code>id</code>. Cursors include a filter
          hash; changing filters invalidates an old cursor. Items updated while
          you page may move in the sort order and appear on a later page or be
          skipped. With <code>q</code>, use the returned <code>nextCursor</code>
          until it is null. Search pagination is capped at offset 1000 (the last
          page may return fewer than <code>limit</code> results).
        </p>
      </LegalSection>

      <LegalSection title="Create & update items">
        <p className="font-medium text-foreground">POST /api/v1/items</p>
        <p>
          Text types (system or custom: code, markdown, link kinds). Send
          <code>type</code> as the system singular name (for example
          <code>snippet</code>, <code>note</code>) or your custom type slug.
          Title max 200 chars; description 2000; content 100,000; URL max 2048
          (required for link kinds). Creating items in custom types without an
          active Pro subscription returns <code>403</code> with code
          <code>forbidden</code>. Up to 20 tags (40 chars each) and 50
          collections.
        </p>
        <p className="mt-4 font-medium text-foreground">PATCH /api/v1/items/:id</p>
        <p>
          Partial updates: send only fields to change. Omitted fields are left
          unchanged. Explicit <code>null</code> on <code>title</code>,
          <code>description</code>, <code>content</code>, <code>url</code>,
          <code>language</code>, <code>tags</code>, or <code>collectionIds</code>
          clears that field (tags and collectionIds become empty). Unknown fields
          are rejected with <code>422</code>. Concurrent PATCH requests are not
          merged; the last successful write wins (no optimistic locking).
        </p>
        <p className="mt-4 font-medium text-foreground">DELETE /api/v1/items/:id</p>
        <p>Moves the item to trash (soft delete).</p>
      </LegalSection>

      <LegalSection title="Collections & tags">
        <p>
          <code>GET /api/v1/collections</code> lists collections.{" "}
          <code>GET /api/v1/tags</code> lists tags that appear on at least one
          active (non-trashed) item.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
