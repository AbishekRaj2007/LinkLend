/**
 * Pulls the `{ message }` body our API sends on 4xx/5xx responses out of a
 * react-query mutation/query error, without depending on api-client-react's
 * internal ApiError class (it isn't part of that package's public exports).
 */
export function extractErrorMessage(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === "object" &&
    "data" in error &&
    error.data &&
    typeof error.data === "object" &&
    "message" in error.data &&
    typeof (error.data as { message?: unknown }).message === "string"
  ) {
    return (error.data as { message: string }).message;
  }
  return fallback;
}
