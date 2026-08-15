
const OPENAI_BASE_URL = 'https://api.openai.com/v1'

function requiredEnv(name) {
  const value = String(process.env[name] ?? '').trim()
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

async function parseResponse(response) {
  const text = await response.text()

  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

export async function openAiRequest(path, options = {}) {
  const apiKey = requiredEnv('OPENAI_API_KEY')
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    Number(options.timeoutMs ?? 30_000),
  )

  try {
    const headers = new Headers(options.headers ?? {})
    headers.set('Authorization', `Bearer ${apiKey}`)
    headers.set('OpenAI-Beta', 'assistants=v2')

    if (options.json !== undefined) {
      headers.set('Content-Type', 'application/json')
    }

    const response = await fetch(`${OPENAI_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.json !== undefined
        ? JSON.stringify(options.json)
        : options.body,
      signal: controller.signal,
    })

    const body = await parseResponse(response)

    if (!response.ok) {
      const message = body?.error?.message
        ?? body?.raw
        ?? `OpenAI API HTTP ${response.status}`

      const error = new Error(message)
      error.status = response.status
      error.body = body
      throw error
    }

    return body
  } finally {
    clearTimeout(timeout)
  }
}

export async function createProductVectorStore(name = 'OZELIF Product Index') {
  return openAiRequest('/vector_stores', {
    method: 'POST',
    json: { name },
  })
}

export async function getVectorStore(vectorStoreId) {
  return openAiRequest(`/vector_stores/${encodeURIComponent(vectorStoreId)}`)
}

export async function uploadTextFile({
  filename,
  content,
}) {
  const form = new FormData()
  form.set('purpose', 'assistants')
  form.set(
    'file',
    new Blob([content], { type: 'text/markdown; charset=utf-8' }),
    filename,
  )

  return openAiRequest('/files', {
    method: 'POST',
    body: form,
    timeoutMs: 60_000,
  })
}

export async function attachFileToVectorStore({
  vectorStoreId,
  fileId,
  attributes,
}) {
  return openAiRequest(
    `/vector_stores/${encodeURIComponent(vectorStoreId)}/files`,
    {
      method: 'POST',
      json: {
        file_id: fileId,
        attributes,
      },
      timeoutMs: 60_000,
    },
  )
}

export async function getVectorStoreFile({
  vectorStoreId,
  fileId,
}) {
  return openAiRequest(
    `/vector_stores/${encodeURIComponent(vectorStoreId)}`
      + `/files/${encodeURIComponent(fileId)}`,
  )
}

export async function waitForVectorStoreFile({
  vectorStoreId,
  fileId,
  timeoutMs = 180_000,
}) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const item = await getVectorStoreFile({
      vectorStoreId,
      fileId,
    })

    if (item?.status === 'completed') return item

    if (['failed', 'cancelled'].includes(item?.status)) {
      throw new Error(
        `Vector Store file ${fileId} finished with status ${item.status}`,
      )
    }

    await sleep(1_500)
  }

  throw new Error(`Timed out waiting for Vector Store file ${fileId}`)
}

export async function deleteOpenAiFile(fileId) {
  if (!fileId) return null

  try {
    return await openAiRequest(`/files/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
    })
  } catch (error) {
    if (error?.status === 404) return null
    throw error
  }
}
