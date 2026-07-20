/** Liveness probe. Intentionally does no I/O so it stays fast and dependency-free. */
export function GET(): Response {
  return Response.json({ status: 'ok' })
}
