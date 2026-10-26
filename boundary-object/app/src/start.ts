import { createStart } from '@tanstack/react-start'

// Everything here is interactive and local; server rendering buys nothing
// and diagrams, selections and theme all want the browser.
export const startInstance = createStart(() => ({ defaultSsr: false }))
