import { after } from "next/server";

import { authenticateApiKey } from "@/lib/api-keys";
import { touchApiKeyLastUsedAtConditional } from "@/lib/db/api-keys";
import { checkApiV1RateLimit } from "@/lib/rate-limit";

import { apiV1Error, applyApiV1RateLimitHeaders } from "./response";

export type ApiV1AuthContext = {
  userId: string;
  keyId: string;
};

type EmptyRouteContext = { params: Promise<object> };

type ApiV1RouteHandler<TContext = EmptyRouteContext> = (
  request: Request,
  auth: ApiV1AuthContext,
  context: TContext,
) => Promise<Response>;

function authFailureResponse(
  code: string,
): { status: number; message: string; errorCode: "unauthorized" | "forbidden" | "rate_limited" } {
  switch (code) {
    case "auth_rate_limited":
      return {
        status: 429,
        message: "Too many failed authentication attempts. Please try again later.",
        errorCode: "rate_limited",
      };
    case "not_pro":
      return {
        status: 403,
        message: "API access requires an active Pro subscription",
        errorCode: "forbidden",
      };
    case "revoked":
    case "expired":
      return {
        status: 401,
        message: "API key is no longer valid",
        errorCode: "unauthorized",
      };
    default:
      return {
        status: 401,
        message: "Invalid or missing API key",
        errorCode: "unauthorized",
      };
  }
}

export function withApiAuth<TContext = EmptyRouteContext>(
  handler: ApiV1RouteHandler<TContext>,
): (request: Request, context: TContext) => Promise<Response> {
  return async (request: Request, context: TContext) => {
    try {
      const authResult = await authenticateApiKey(request);

      if (!authResult.success) {
        const failure = authFailureResponse(authResult.code);

        return apiV1Error(failure.errorCode, failure.message, failure.status, {
          rateLimit: authResult.rateLimit,
        });
      }

      const rateLimit = await checkApiV1RateLimit(authResult.keyId);

      if (!rateLimit.success) {
        return apiV1Error(
          "rate_limited",
          "Too many requests. Please try again later.",
          429,
          { rateLimit },
        );
      }

      after(() => {
        return touchApiKeyLastUsedAtConditional(authResult.keyId).catch(
          (error) => {
            console.error("Failed to update API key lastUsedAt:", error);
          },
        );
      });

      const response = await handler(request, authResult, context);

      applyApiV1RateLimitHeaders(response, rateLimit);
      response.headers.set("Cache-Control", "no-store");

      return response;
    } catch (error) {
      console.error("API v1 request failed:", error);

      const response = apiV1Error(
        "internal_error",
        "An unexpected error occurred",
        500,
      );

      response.headers.set("Cache-Control", "no-store");

      return response;
    }
  };
}
