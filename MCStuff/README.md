# MCStuff

Рабочее пространство Minecraft с рабочим Colors & Formatting и будущим подбором сборок через Modrinth. Сайт полностью на английском; общение с владельцем и документация — на русском.

## Текущее состояние

- Главная MCStuff со ссылкой на рабочий инструмент.
- Colors & Formatting (`#colors`) — локальный генератор сообщений и справочник цветов / форматирования.
- Pack Builder (`#builder`) — каркас без интеграции Modrinth, скачивания или подбора зависимостей.
- Поиск инструментов по названию и aliases; Ctrl/Cmd+K, стрелки, Enter, Escape, кнопки sidebar / мобильной шапки. Открытие, закрытие и результаты анимированы.

Название вкладки всегда строго `MCStuff`. Бренд в sidebar / мобильной шапке целиком Bold 700 (Golos Text). Главная открывается без hash и по клику на бренд; старые `#overview`, `#resources`, `#tools` открывают главную. Подсветка меню скользит, страницы переключаются мгновенно.

Dark Modern: фон `#101113`, sidebar `#151619`, основной текст и нейтральные линии не перекрашиваются. Пять фиксированных акцентов: Green (#22c55e, по умолчанию), Blue (#4b91ff), Yellow (#facc15), Red (#ff5252), Purple (#a970ff). Кружки 22 × 28 px, gap 2px, выравнивание влево, без кольца выбранного цвета. Discord у правого края нижней строки: `https://discord.com/invite/xQqbSxAWJ9`.

По последнему требованию свой акцент сайта удалён. Ранний скрипт восстанавливает preset из `mcstuff-theme` до CSS, старые Amber / Rose отображает как Yellow / Red. Старый режим custom заменяет на Green, `mcstuff-custom-accent` удаляет. HEX-поля в инструменте меняют только текст Minecraft.

Звук акцента — sine, 760 → 580 Hz, 70 ms; навигации — triangle, 440 → 300 Hz, 50 ms. Оба используют gain 0.025 и один ленивый AudioContext. Повторный выбор, reload и Discord без звука; ошибки аудио не блокируют интерфейс. Анимации меню / поиска по требованию пользователя не отключаются автоматически при prefers-reduced-motion.

## Colors & Formatting

Генератор принимает обычный текст (до 2000 символов), цвет или двухцветный градиент и декорации: bold, italic, underlined, strikethrough, obfuscated. Есть сброс стилей, проверка HEX (3 / 6 цифр), безопасный browser preview, кнопка копирования результата.

Форматы вывода:

- MiniMessage — именованный / HEX-цвет или gradient, декорации, экранирование `<` и обратного слеша, закрытие тегов в обратном порядке.
- Legacy `&` и `§` — ближайший из 16 стандартных цветов; после смены цвета стили применяются повторно, в конце добавляется reset.
- Короткий RGB `&#RRGGBB` / `§#RRGGBB`.
- BungeeCord RGB `&x&R&R&G&G&B&B` / `§x§R§R§G§G§B§B`.
- JSON (Java) — текстовый компонент; при градиенте по одному компоненту на Unicode code point.

Справочник содержит все 16 цветов Minecraft Java, HEX, Legacy `&` / `§`, MiniMessage и пять декораций + reset. Код можно скопировать, цвет — применить к сообщению. Дополнительно есть MiniMessage snippets: gradient, rainbow, transition, shadow, hover, click, font, newline, keybind, translation, insertion и выключение стиля.

Это генератор из plain text, не полный парсер произвольных MiniMessage / Legacy-строк. Browser preview использует системный monospace, а не шрифт Minecraft; obfuscated имитируется сменой символов. Совместимость RGB-синтаксиса зависит от плагина и указана рядом с выбранным форматом. MiniMessage strict mode не поддерживает `<reset>`; Legacy не поддерживает hover / click. Зарезервированные Legacy-коды внутри обычного текста не имеют универсального способа экранирования.

Текст обрабатывается только в браузере, не отправляется в сеть и не пишется в localStorage. При переходах между разделами состояние сохраняется в памяти; reload сбрасывает генератор. Таймеры прекращаются при уходе. Copied появляется только после успешной записи в Clipboard API; при отказе выделяется текст для ручного копирования.

Основные источники: [MiniMessage format](https://docs.papermc.io/adventure/minimessage/format/) и [Legacy serializer](https://docs.papermc.io/adventure/serializer/legacy/). Значения Minecraft / Adventure не привязаны к вручную объявленной «последней версии».

## Технологии и файлы

Buildless HTML / CSS / JavaScript ES modules, без npm-зависимостей и фреймворка. Node.js 22+ для локального сервера / проверок; проверено на Node.js 24.16.0, npm 11.13.0.

- `public/index.html` — каркас, меню, 5 акцентов, dialog поиска, раннее восстановление preset.
- `public/styles.css` — Dark Modern, адаптивность от 320 px, стили инструмента и анимации поиска / меню.
- `public/app.js` — маршрутизация, title, темы, звук, мобильное меню, жизненный цикл инструмента.
- `public/formatting.js` — палитра, декорации, RGB, градиенты, сериализаторы и snippets.
- `public/colors-tool.js` — UI, preview, проверка ввода, справочники / копирование, очистка таймеров.
- `public/tool-catalog.js` — реестр существующих инструментов и поисковые aliases.
- `public/tool-search.js` — dialog, поиск, клавиатура, анимация закрытия, возврат фокуса.
- `public/favicon.svg` — знак с зелёным акцентом.
- `scripts/dev.mjs` — локальный HTTP-сервер на loopback, порт 4173 / env PORT.
- `tests/*.test.mjs` — тесты форматирования и поиска на встроенном Node test runner.
- `../wrangler.jsonc` — единственный конфиг Workers Static Assets, `./MCStuff/public`, SPA fallback, Worker mcstuff, compatibility date 2026-11-01.
- `../LICENSE` — MIT, Copyright (c) 2026 MCP.

Внешний шрифт Golos Text — Google Fonts, при недоступности используется системный. Иконка Discord встроена в HTML ([Simple Icons](https://github.com/simple-icons/simple-icons/blob/develop/icons/discord.svg)). Генератор / поиск внешних API не вызывают.

## Локальная работа и проверка

Из папки MCStuff:

```powershell
npm run dev
npm run check
npm test
```

Адрес: `http://127.0.0.1:4173`. Установка зависимостей и компиляция не нужны. Из корня репозитория подготовка без публикации: `npx wrangler@4.156.1 deploy --dry-run`.

Проверены 12 тестов: 16 цветов, HEX-валидация, MiniMessage escaping / закрытие тегов, декорации, RGB-префиксы, Legacy reset / gradient, Unicode, JSON и поисковые aliases. В браузере подтверждены градиент / стили / JSON, блокировка копирования невалидного HEX, реальное совпадение clipboard, переходы и сохранение состояния, поиск / Ctrl+K / стрелки / Enter / Escape, mobile 320 px без переполнения. Таблицы прокручиваются внутри блока, фокус возвращается корректно; title MCStuff и чистая консоль сохранены.

Переносимая сборка — исходники, документация, MIT и корневой конфиг с сохранённой структурой MCStuff/public. Git-метаданные, зависимости, кэши и секреты в архив не включать. Подготовка архива не является публикацией.

## GitHub → Cloudflare Workers

Репозиторий: [TheMCP123/mcstuff](https://github.com/TheMCP123/mcstuff), remote origin, main. Checkout находится в родительской папке, исходники — в MCStuff. Пользователь подключает GitHub / Cloudflare самостоятельно. Commit, push и deploy разрешены только отдельной явной командой; push запускает Workers Builds.

- Root directory: корень репозитория (`/` или пусто).
- Build command: не требуется.
- Deploy command: `npx wrangler@4.156.1 deploy` (существующая `npx wrangler deploy` тоже поддерживается).
- Worker name: mcstuff.
- Assets: MCStuff/public, в корневом wrangler.jsonc.

`npm run deploy` из MCStuff передаёт `--config ../wrangler.jsonc`. Не переносить конфиг только в подпапку: первая сборка падала из-за запуска Wrangler из корня без найденного assets.directory. Wrangler 4.156.1 закреплён по рабочей конфигурации. Секреты и .wrangler не коммитить, force-push не использовать.

Автодеплой проверять по актуальному списку `/repos/TheMCP123/mcstuff/commits/<sha>/check-runs?filter=latest&per_page=20`, не по сохранённому check-run ID. Локальные проверки, push и успешный Cloudflare deployment — разные результаты.

Адрес по умолчанию: `mcstuff.<поддомен-аккаунта>.workers.dev`; конкретный поддомен определяется аккаунтом владельца. Документация: [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/), [Static Assets](https://developers.cloudflare.com/workers/static-assets/).

## Дальше

Следующий крупный этап — Pack Builder: Modrinth, версии / платформы, совместимые файлы, зависимости и экспорт. Точный контракт ещё не утверждён; не подменять его макетами или фиктивными результатами. Состав ресурсов Minecraft уточняется отдельно.

Проект распространяется под MIT; внешние материалы сохраняют свои условия. Подробная история решений — CHANGELOG.md, постоянные требования — AGENTS.md.
