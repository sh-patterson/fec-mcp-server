/**
 * Custom Error Types for FEC MCP Server
 */

const REDACTED_VALUE = '[REDACTED]';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Redact API key values from arbitrary text to avoid leaking secrets in tool output.
 */
export function sanitizeApiKey(text: string, apiKey?: string): string {
  let sanitized = text
    .replace(/([?&]api_key=)([^&#\s]+)/gi, `$1${REDACTED_VALUE}`)
    .replace(/("api_key"\s*:\s*")[^"]+(")/gi, `$1${REDACTED_VALUE}$2`);

  if (apiKey) {
    sanitized = sanitized.replace(new RegExp(escapeRegExp(apiKey), 'g'), REDACTED_VALUE);
  }

  return sanitized;
}

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
  const apiKey = process.env.FEC_API_KEY;
  let message: string;

  if (error instanceof RateLimitError) {
    message = 'Rate limit exceeded. The FEC API has request limits. Please wait a moment and try again.';
    return sanitizeApiKey(message, apiKey);
  }

  if (error instanceof NotFoundError) {
    message = error.message;
    return sanitizeApiKey(message, apiKey);
  }

  if (error instanceof FECApiError) {
    message = `FEC API error: ${error.message}`;
    return sanitizeApiKey(message, apiKey);
  }

  if (error instanceof ValidationError) {
    message = `Invalid input: ${error.message}`;
    return sanitizeApiKey(message, apiKey);
  }

  if (error instanceof Error) {
    message = `Error: ${error.message}`;
    return sanitizeApiKey(message, apiKey);
  }

  message = 'An unexpected error occurred.';
  return sanitizeApiKey(message, apiKey);
}
