import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'

export function getOrCreateReceipt (answers, previous) {
  if (previous && isDeepStrictEqual(previous.answers, answers)) return previous
  const id = randomUUID()
  return {
    id,
    reference: id.replaceAll('-', '').slice(0, 12).toUpperCase(),
    answers: structuredClone(answers)
  }
}
