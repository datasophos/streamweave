interface ErrorMessageProps {
  error: unknown
  fallback?: string
}

export function ErrorMessage({ error, fallback = 'An error occurred.' }: ErrorMessageProps) {
  let message = fallback
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { data?: { detail?: string } } }).response?.data?.detail ===
      'string'
  ) {
    message = (error as { response: { data: { detail: string } } }).response.data.detail
  } else if (error instanceof Error && !('response' in error)) {
    // Non-HTTP errors (e.g. network errors) — use the error message directly
    message = error.message
  }
  // HTTP errors without a detail field fall back to the `fallback` prop
  return (
    <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700">
      {message}
    </div>
  )
}
