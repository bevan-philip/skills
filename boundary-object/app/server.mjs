// Production entry, started by scripts/boundary.mjs after `npm run build`.
// Serves the built client assets and hands everything else to the TanStack
// Start fetch handler.
import { serve } from 'srvx'
import { staticMiddleware } from 'srvx/static'
import { fileURLToPath } from 'node:url'
import app from './dist/server/server.js'

const port = Number(process.env.PORT || 4317)
const host = process.env.HOST || '127.0.0.1'

// Feedback from this server goes straight into an agent's context, so only
// the human's own browser tab and the CLI may talk to it. The Host check stops
// DNS rebinding; Sec-Fetch-Site and Origin stop other sites from reading
// boards or posting forged feedback through the browser.
const LOCAL = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/

function guard(req, next) {
  const h = req.headers.get('host') ?? ''
  if (!LOCAL.test(h)) return new Response('Forbidden host\n', { status: 403 })
  const site = req.headers.get('sec-fetch-site')
  if (site === 'cross-site' || site === 'same-site') return new Response('Cross-site request refused\n', { status: 403 })
  const origin = req.headers.get('origin')
  if (req.method !== 'GET' && req.method !== 'HEAD' && origin) {
    let ok = false
    try {
      ok = new URL(origin).host === h
    } catch {}
    if (!ok) return new Response('Cross-origin request refused\n', { status: 403 })
  }
  return next()
}

const server = serve({
  port,
  hostname: host,
  silent: true,
  // srvx's own handler closes the listener but leaves the process running
  // (file watchers and SSE timers keep it alive), so exit explicitly.
  gracefulShutdown: false,
  middleware: [guard, staticMiddleware({ dir: fileURLToPath(new URL('./dist/client', import.meta.url)) })],
  fetch: (req) => app.fetch(req),
})

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    setTimeout(() => process.exit(0), 1000).unref()
    server.close(true).finally(() => process.exit(0))
  })
}
