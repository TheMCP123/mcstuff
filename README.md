# MCStuff

Сборки, ресурсы и инструменты для Minecraft.

Первая версия содержит только адаптивный интерфейс и навигацию. Билдер сборок, Modrinth, поиск и скачивание пока не реализованы.

Исходники и документация проекта находятся в [`MCStuff/`](MCStuff/README.md).

## Локальный запуск

Нужен Node.js 22 или новее. Установка зависимостей не требуется.

```powershell
cd MCStuff
npm run dev
```

Локальный адрес: `http://127.0.0.1:4173`. Проверка JavaScript: `npm run check`.

## Cloudflare Workers

- Root directory: `MCStuff`.
- Build command: оставить пустым.
- Deploy command: `npx wrangler@4 deploy`.
- Имя Worker: `mcstuff`.

Конфигурация находится в `MCStuff/wrangler.jsonc`. Подключение Workers выполняется в аккаунте владельца репозитория. Обновления отправляются только по его явной команде.

## Лицензия

[MIT](LICENSE), Copyright (c) 2026 MCP.
