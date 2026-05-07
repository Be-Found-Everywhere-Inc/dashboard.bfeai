import type { Handler, HandlerContext, HandlerEvent, HandlerResponse } from "@netlify/functions";

export class HttpError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
//
// These Netlify Functions are called cross-origin from consumer apps with
// `credentials: "include"` (e.g. purchaseTopUp() in keywords/labs/sma/offpage
// calls dashboard.bfeai/.netlify/functions/credits-topup).
//
// A wildcard `Access-Control-Allow-Origin: *` does NOT work with credentials —
// browsers reject it. We must echo the calling origin if it is on our
// allowlist, and include `Access-Control-Allow-Credentials: true` plus
// `Vary: Origin`.
//
// Branch-deploy gap: branch deploys use `<branch>--<sitename>.netlify.app`
// hostnames which are NOT in this allowlist. Cross-subdomain credit calls
// from branch deploys will be blocked by the browser. This is intentional —
// branch deploys should hit their own dashboard branch deploy or be tested
// via same-origin paths. See docs/04-Architecture/branch-deploy-auth-bypass.md.

const ALLOWED_ORIGINS = [
  "https://dashboard.bfeai.com",
  "https://keywords.bfeai.com",
  "https://labs.bfeai.com",
  "https://sma.bfeai.com",
  "https://offpage.bfeai.com",
];

const getEventOrigin = (event?: HandlerEvent): string | undefined => {
  if (!event) return undefined;
  return event.headers?.origin ?? event.headers?.Origin;
};

export const corsHeaders = (origin?: string): Record<string, string> => {
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin",
  };
};

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export const jsonResponse = (
  statusCode: number,
  data: unknown,
  event?: HandlerEvent
): HandlerResponse => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    ...corsHeaders(getEventOrigin(event)),
  },
  body: JSON.stringify(data),
});

export const handleError = (error: unknown, event?: HandlerEvent): HandlerResponse => {
  if (error instanceof HttpError) {
    return jsonResponse(error.statusCode, { error: error.message, details: error.details }, event);
  }

  console.error("Unexpected function error:", error);
  return jsonResponse(500, { error: "Internal server error" }, event);
};

type AsyncHandler = (event: HandlerEvent, context: HandlerContext) => Promise<HandlerResponse>;

export const withErrorHandling = (handler: AsyncHandler): Handler => {
  return async (event, context) => {
    // Handle CORS preflight before invoking the wrapped handler. Returning
    // 204 with the CORS headers (or no CORS headers if the origin is not on
    // the allowlist — browser will then block the actual request) is the
    // standard pattern.
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 204,
        headers: corsHeaders(getEventOrigin(event)),
        body: "",
      };
    }

    try {
      const response = await handler(event, context);
      // If the wrapped handler built its response without going through
      // jsonResponse (or built it before CORS was wired in), make sure CORS
      // headers are still applied on the way out.
      const cors = corsHeaders(getEventOrigin(event));
      if (Object.keys(cors).length === 0) return response;
      return {
        ...response,
        headers: { ...(response.headers ?? {}), ...cors },
      };
    } catch (error) {
      return handleError(error, event);
    }
  };
};
