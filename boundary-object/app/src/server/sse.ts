// Server-sent events with a heartbeat so idle proxies and browsers keep the
// connection open. `setup` returns its own cleanup.
export function sse(request: Request, setup: (send: (event: string, data: unknown) => void) => () => void) {
  const enc = new TextEncoder()
  let cleanup = () => {}
  let beat: ReturnType<typeof setInterval>
  const stream = new ReadableStream({
    start(c) {
      const send = (event: string, data: unknown) => {
        try {
          c.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data ?? null)}\n\n`))
        } catch {
          stop()
        }
      }
      const stop = () => {
        clearInterval(beat)
        cleanup()
        try {
          c.close()
        } catch {}
      }
      cleanup = setup(send)
      beat = setInterval(() => send('ping', Date.now()), 15000)
      send('ready', null)
      request.signal.addEventListener('abort', stop)
    },
    cancel() {
      clearInterval(beat)
      cleanup()
    },
  })
  return new Response(stream, {
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' },
  })
}
