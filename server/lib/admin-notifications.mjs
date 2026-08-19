function clean(value, limit = 4_000) {
  const normalized = String(value ?? '').trim()
  return normalized ? normalized.slice(0, limit) : null
}

function executor(db) {
  if (typeof db === 'function') return db
  if (db && typeof db.query === 'function') return db.query.bind(db)
  throw new TypeError('enqueueAdminNotification requires query function/client')
}

export async function enqueueAdminNotification(
  db,
  { eventType, aggregateType, aggregateId, payload = {} },
) {
  const event = clean(eventType, 120)
  const aggregate = clean(aggregateType, 120)
  const id = clean(aggregateId, 100)
  if (!event || !aggregate || !id) {
    throw new TypeError('Admin notification requires event/aggregate/id')
  }
  const run = executor(db)
  return run(
    `INSERT INTO notification_outbox (
       event_type, aggregate_type, aggregate_id, channel, recipient, payload
     )
     VALUES ($1, $2, $3::uuid, 'admin', 'crm', $4::jsonb)
     ON CONFLICT DO NOTHING`,
    [event, aggregate, id, JSON.stringify(payload ?? {})],
  )
}

export async function safeEnqueueAdminNotification(
  db,
  notification,
  { logger = console } = {},
) {
  try {
    await enqueueAdminNotification(db, notification)
    return true
  } catch (error) {
    logger?.error?.('[admin-notification enqueue]', error)
    return false
  }
}
