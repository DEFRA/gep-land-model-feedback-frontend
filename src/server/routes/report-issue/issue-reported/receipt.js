import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'

const REFERENCE_LENGTH = 12

export function getOrCreateReceipt (answers, previous) {
  if (previous && isDeepStrictEqual(previous.answers, answers)) {
    return previous
  }
  const id = randomUUID()
  return {
    id,
    reference: id.replaceAll('-', '').slice(0, REFERENCE_LENGTH).toUpperCase(),
    answers: structuredClone(answers)
  }
}
