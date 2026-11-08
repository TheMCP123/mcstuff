# MCStuff

Сборки, ресурсы и инструменты для Minecraft.

Рабочий инструмент Colors & Formatting: цвета Minecraft, стили, MiniMessage / Legacy / HEX / JSON, градиенты, предпросмотр и копирование. Поиск прямо в sidebar фильтрует меню с анимацией, учитывает синонимы, опечатки и раскладку; отдельного окна и глобальной горячей клавиши нет. У Pack Builder иконка коробки, у Colors & Formatting — палитры. Pack Builder собирает плагины, моды, ресурспаки и датапаки: Modrinth / SpigotMC через Spiget, совместимые версии, обязательные зависимости, отдельные файлы и ZIP. CurseForge adapter готов, активируется серверным API-ключом.

Интерфейс сайта полностью на английском языке. Отступы всех вкладок одинаковые, цвета и Discord опущены ближе к нижнему краю. IGN поддерживает Single / Bulk до 10 имён: валидацию, остановку очереди, копирование TSV и переход к скину по UUID.

Списки, выбор цвета и остальные элементы форм оформлены в стиле сайта. Pack Builder получил крупные кнопки, ровные фильтры / карточки, поиск в списках версий и прокрутку файлов с доступными действиями скачивания; мобильный список сборки сворачивается.

Иконки — готовый Lucide. Skin Stealer имеет 3D-превью с вращением; Waypoint Color использует оригинальные текстуры шкалы и четырёх меток Minecraft Java с сохранением авторства / provenance. Lookup использует официальные endpoints и проверенный резерв PlayerDB. В IGN официальное подтверждение, исторический кэш и отсутствие подтверждённой записи различаются; резервный ответ не выдаётся за гарантированно свободный ник.

В General работают Pack Builder и Colors & Formatting. В Checkers работают Skin Stealer (текущий скин / PNG), Waypoint Color (цвет Locator Bar по нику / UUID) и IGN Availability (проверка регистрации ника). Отсутствие профиля не гарантирует возможность занять ник. Поиск сохраняет группировку и временно скрывает пустые категории.

Название MCStuff в боковой панели и мобильной шапке целиком Bold.

Подсветка меню анимирована, сами страницы переключаются мгновенно, title всегда MCStuff. Внизу — пять акцентов (Green по умолчанию, Blue, Yellow, Red, Purple) и Discord справа. Выбор собственного акцента удалён. Главная открывается при входе и по клику на MCStuff; пункта Overview в меню нет.

Исходники и документация проекта находятся в [`MCStuff/`](MCStuff/README.md).

## Локальный запуск

Нужен Node.js 22 или новее. Установка зависимостей не требуется.

```powershell
cd MCStuff
npm run dev
```

Локальный адрес: `http://127.0.0.1:4173` (Pack Builder: #builder). Проверка JavaScript: `npm run check`, тесты: `npm test`. Optional CurseForge key — CURSEFORGE_API_KEY в root .dev.vars / Worker secret; реальный ключ никогда не коммитить. Экспорт ZIP сохраняет исходные файлы по папкам, ошибки / ручные скачивания отмечены; limits v1 — 50 projects / 64MB per file / 128MB ZIP.

## Cloudflare Workers

- Root directory: корень репозитория (`/` или пустое значение).
- Build command: оставить пустым.
- Deploy command: `npx wrangler@4.156.1 deploy`. Стандартная команда `npx wrangler deploy` также найдёт корневой конфиг.
- Имя Worker: `mcstuff`.

Единственная конфигурация `wrangler.jsonc` находится в корне репозитория: assets `MCStuff/public`, main `MCStuff/worker/index.js`, ASSETS binding и Worker first для API. Отдельная команда сборки не требуется; Wrangler бандлит Worker при deploy. Локальная команда `npm run deploy` из `MCStuff` явно использует этот же конфиг. Подключение Workers выполняется в аккаунте владельца репозитория. Обновления отправляются только по его явной команде.

## Лицензия

[MIT](LICENSE), Copyright (c) 2026 MCP. Игровые PNG принадлежат Mojang / Microsoft и не покрываются MIT проекта; provenance — MCStuff/public/textures/minecraft/NOTICE.txt.
