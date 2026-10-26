export { cn } from 'cn'

export const newId = () => `fb-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
