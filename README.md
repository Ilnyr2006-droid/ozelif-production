# OZELIF website

Frontend сайта OZELIF: главная страница, «О компании», «Оптовикам» и «Швейное производство».

## Локальный запуск

```bash
npm install
npm run dev
```

После запуска сайт доступен по адресу `http://127.0.0.1:5173`.

## Production deployment

Шаблоны Nginx и systemd, безопасный порядок frontend/backend-релиза и отката описаны в [docs/deployment.md](docs/deployment.md). Перед публикацией запускайте:

```bash
npm run deploy:check
```

## Маршруты

- `/` — главная;
- `/kozhaozelif` — о компании;
- `/kozhaoptom` — оптовым клиентам;
- `/production` — швейное производство.

## Проверки

```bash
npm run lint
npm run typecheck
npm test -- --run
npm run build
```

## Форма заявок

Формы используют `VITE_FORM_ENDPOINT`. Если переменная не задана, интерфейс показывает понятное сообщение и не имитирует отправку.

Создайте `.env.local` для реального endpoint:

```bash
VITE_FORM_ENDPOINT=https://example.com/form-endpoint
```

Не коммитьте файлы `.env*` с реальными ключами или адресами внутренних сервисов.

## Работа с ChatGPT

Подключите репозиторий в ChatGPT через **Settings → Apps → GitHub** и разрешите доступ к этому репозиторию. Обычный GitHub App в ChatGPT предназначен для чтения, поиска и анализа кода. Для внесения изменений, коммитов и push используйте Codex или Agent/Codex-режим с доступом к GitHub.

Перед публикацией изменений запускайте все проверки из раздела выше. Содержательные правила и источники фактов по страницам находятся в `docs/`.

---

## Project documentation

Before editing or deploying the current production project, read:

- [PROJECT_MAP.md](PROJECT_MAP.md)
- [AI_HANDOFF.md](AI_HANDOFF.md)
- [DEPLOYMENT.md](DEPLOYMENT.md)
- [SECURITY.md](SECURITY.md)
