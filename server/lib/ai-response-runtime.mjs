function addNumbers(target, source) {
  if (!source || typeof source !== 'object') return target

  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      target[key] = (target[key] ?? 0) + value
      continue
    }

    if (
      value
      && typeof value === 'object'
      && !Array.isArray(value)
    ) {
      target[key] = addNumbers(
        target[key] && typeof target[key] === 'object'
          ? target[key]
          : {},
        value,
      )
    }
  }

  return target
}

export function mergeOpenAiUsage(...values) {
  const usages = values
    .flat()
    .filter(value => (
      value
      && typeof value === 'object'
    ))

  if (!usages.length) return null

  return usages.reduce(
    (result, usage) => addNumbers(result, usage),
    {},
  )
}

export function responseIncompleteReason(body) {
  if (!body || typeof body !== 'object') {
    return 'missing_response'
  }

  if (body.status === 'completed') return null

  return (
    body?.incomplete_details?.reason
    ?? body?.error?.code
    ?? body?.status
    ?? 'unknown'
  )
}

export function shouldRetryIncompleteResponse(body) {
  return responseIncompleteReason(body) !== null
}

export function retryOutputTokenLimit(value, minimum = 900) {
  const current = Number(value)

  if (!Number.isFinite(current) || current <= 0) {
    return minimum
  }

  return Math.max(
    minimum,
    Math.ceil(current * 1.5),
  )
}
