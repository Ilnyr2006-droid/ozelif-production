import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

type EmbedResponse = {
  url: string
  expiresAt: string
}

type LoadState =
  | { status: 'loading' }
  | {
      status: 'ready'
      url: string
    }
  | {
      status: 'error'
      message: string
    }

async function loadEmbedUrl(
  signal?: AbortSignal,
): Promise<EmbedResponse> {
  const response = await fetch(
    '/api/admin/metabase/embed',
    {
      credentials: 'include',
      signal,
      headers: {
        Accept: 'application/json',
      },
    },
  )

  if (!response.ok) {
    const payload = await response
      .json()
      .catch(() => null)

    const message =
      payload?.error
      ?? payload?.message
      ?? `HTTP ${response.status}`

    throw new Error(message)
  }

  return response.json()
}

export function MetabaseAnalytics() {
  const [state, setState] =
    useState<LoadState>({
      status: 'loading',
    })

  const refreshTimer =
    useRef<number | null>(null)

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setState({
        status: 'loading',
      })

      try {
        const payload =
          await loadEmbedUrl(signal)

        if (signal?.aborted) {
          return
        }

        setState({
          status: 'ready',
          url: payload.url,
        })

        if (refreshTimer.current) {
          window.clearTimeout(
            refreshTimer.current,
          )
        }

        /*
         * JWT действует 10 минут.
         * Обновляем iframe заранее.
         */
        refreshTimer.current =
          window.setTimeout(
            () => {
              void load()
            },
            8 * 60 * 1000,
          )
      } catch (error) {
        if (signal?.aborted) {
          return
        }

        setState({
          status: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Не удалось загрузить аналитику',
        })
      }
    },
    [],
  )

  useEffect(() => {
    const controller =
      new AbortController()

    void load(controller.signal)

    return () => {
      controller.abort()

      if (refreshTimer.current) {
        window.clearTimeout(
          refreshTimer.current,
        )
      }
    }
  }, [load])

  return (
    <section
      style={{
        display: 'grid',
        gap: 16,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <p
            style={{
              margin: '0 0 4px',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: '#b4512b',
            }}
          >
            Business intelligence
          </p>

          <h2
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 30,
              fontWeight: 500,
            }}
          >
            Аналитика OZELIF
          </h2>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={
            state.status === 'loading'
          }
          style={{
            minHeight: 40,
            padding: '0 18px',
            border:
              '1px solid rgba(45,35,29,.18)',
            borderRadius: 12,
            background: '#fff',
            cursor:
              state.status === 'loading'
                ? 'wait'
                : 'pointer',
          }}
        >
          Обновить
        </button>
      </header>

      {state.status === 'loading' && (
        <div
          role="status"
          style={{
            display: 'grid',
            placeItems: 'center',
            minHeight: 560,
            border:
              '1px solid rgba(45,35,29,.12)',
            borderRadius: 18,
            background: '#fff',
          }}
        >
          Загружаем аналитику…
        </div>
      )}

      {state.status === 'error' && (
        <div
          role="alert"
          style={{
            display: 'grid',
            gap: 12,
            placeItems: 'center',
            minHeight: 360,
            padding: 32,
            border:
              '1px solid rgba(180,81,43,.25)',
            borderRadius: 18,
            background: '#fff',
            textAlign: 'center',
          }}
        >
          <strong>
            Не удалось открыть Metabase
          </strong>

          <span>
            {state.message}
          </span>

          <button
            type="button"
            onClick={() => void load()}
          >
            Повторить
          </button>
        </div>
      )}

      {state.status === 'ready' && (
        <div
          style={{
            overflow: 'hidden',
            minHeight: 760,
            border:
              '1px solid rgba(45,35,29,.12)',
            borderRadius: 18,
            background: '#fff',
            boxShadow:
              '0 20px 45px rgba(34,26,21,.08)',
          }}
        >
          <iframe
            title="Аналитика OZELIF"
            src={state.url}
            allowFullScreen
            style={{
              display: 'block',
              width: '100%',
              height: 'clamp(760px, 82vh, 1100px)',
              border: 0,
              background: '#fff',
            }}
          />
        </div>
      )}
    </section>
  )
}
