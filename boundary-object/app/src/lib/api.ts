import { createServerFn } from '@tanstack/react-start'
import { draft, verdict } from './schema'
import { z } from 'zod'
import { getView, listBoards, saveDraft, submit } from '@/server/store'

export const getBoard = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.string() }))
  .handler(({ data }) => getView(data.id))

export const getBoards = createServerFn({ method: 'GET' }).handler(() => listBoards())

export const putDraft = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string(), draft }))
  .handler(({ data }) => saveDraft(data.id, data.draft))

export const sendRound = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.string(), verdict, overall: z.string().optional(), draft, revision: z.number().int() }))
  .handler(({ data }) => submit(data.id, data))
