// src/lib/api/errors.ts
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export class NetworkError extends Error {
  constructor(message = "Network request failed") {
    super(message)
    this.name = "NetworkError"
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export function handleApiError(error: unknown): string {
  if (isApiError(error)) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return "An unexpected error occurred"
}

/**
 * Enhanced API error response helper - preserves status and context
 * Use this in API routes for consistent error responses
 */
export function createErrorResponse(
  error: unknown,
  defaultMessage = "An unexpected error occurred"
): { success: false; error: string; status: number } {
  if (isApiError(error)) {
    return {
      success: false,
      error: error.message,
      status: error.status,
    }
  }
  if (error instanceof Error) {
    return {
      success: false,
      error: error.message,
      status: 500,
    }
  }
  return {
    success: false,
    error: defaultMessage,
    status: 500,
  }
}
