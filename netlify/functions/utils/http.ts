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

export const jsonResponse = (statusCode: number, data: unknown): HandlerResponse => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  },
  body: JSON.stringify(data),
});

export const handleError = (error: unknown): HandlerResponse => {
  if (error instanceof HttpError) {
    return jsonResponse(error.statusCode, { error: error.message, details: error.details });
  }

  console.error("Unexpected function error:", error);
  return jsonResponse(500, { error: "Internal server error" });
};

type AsyncHandler = (event: HandlerEvent, context: HandlerContext) => Promise<HandlerResponse>;

export const withErrorHandling = (handler: AsyncHandler): Handler => {
  return async (event, context) => {
    try {
      return await handler(event, context);
    } catch (error) {
      return handleError(error);
    }
  };
};
