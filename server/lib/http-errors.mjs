export function jsonNotFoundHandler(request, response) {
  response.status(404).json({
    error: 'not_found',
    path: request.originalUrl || request.url,
  })
}

export function jsonErrorHandler(error, _request, response, _next) {
  console.error(error)

  const status = Number(error?.status)
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    response.status(status).json({ error: String(error?.message || 'Некорректный запрос') })
    return
  }

  if (error?.name === 'MulterError') {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400
    response.status(status).json({ error: status === 413 ? 'Файл превышает допустимый размер 12 МБ' : 'Не удалось загрузить файл' })
    return
  }

  if (error?.code === '23505') {
    response.status(409).json({ error: 'Такой адрес уже используется' })
    return
  }

  response.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Внутренняя ошибка сервера'
      : String(error?.message ?? error),
  })
}
