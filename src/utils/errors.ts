/**
 * Custom Error Types for FEC MCP Server
 */

export class FECApiError extends Error {
  public readonly statusCode?: number;
  public readonly endpoint?: string;

  constructor(message: string, statusCode?: number, endpoint?: string) {
    super(message);
    this.name = 'FECApiError';
    this.statusCode = statusCode;
    this.endpoint = endpoint;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace?.(this, FECApiError);
  }
}

export class RateLimitError extends FECApiError {
  public readonly retryAfter?: number;

  constructor(retryAfter?: number) {
    const message = retryAfter
      ? `FEC API rate limit exceeded. Retry after ${retryAfter} seconds.`
      : 'FEC API rate limit exceeded.';
    super(message, 429);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class ValidationError extends Error {
  public readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;

    Error.captureStackTrace?.(this, ValidationError);
  }
}

export class NotFoundError extends FECApiError {
  constructor(resource: string, id?: string) {
    const message = id
      ? `${resource} with ID "${id}" not found.`
      : `${resource} not found.`;
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

/**
 * Format error for MCP tool response
 */
export function formatErrorForToolResponse(error: unknown): string {
  if (error instanceof RateLimitError) {
    return `Rate limit exceeded. The FEC API has request limits. Please wait a moment and try again.`;
  }

  if (error instanceof NotFoundError) {
    return error.message;
  }

  if (error instanceof FECApiError) {
    return `FEC API error: ${error.message}`;
  }

  if (error instanceof ValidationError) {
    return `Invalid input: ${error.message}`;
  }

  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }

  return 'An unexpected error occurred.';
}
