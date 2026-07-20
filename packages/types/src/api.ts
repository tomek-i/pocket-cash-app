/**
 * Transport-level API envelope shared by route handlers and clients. Keeping
 * this stable is what lets a future dedicated API app (Hono/Fastify) and native
 * clients consume the same contract without churn.
 */
export type ApiErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'internal'

export interface ApiError {
  code: ApiErrorCode
  message: string
  /** Optional field-level validation issues, keyed by field path. */
  fields?: Record<string, string[]>
}

export type ApiSuccess<T> = { data: T; error?: never }
export type ApiFailure = { data?: never; error: ApiError }
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure

/** Maps an ApiErrorCode to its HTTP status. */
export const API_ERROR_STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  internal: 500,
}
