# MCStuff

Рабочее пространство Minecraft с Colors & Formatting, тремя Checkers и будущим подбором сборок через Modrinth. Сайт полностью на английском; общение с владельцем и документация — на русском.

## Текущее состояние

- Главная MCStuff со ссылкой на рабочий инструмент.
- Colors & Formatting (`#colors`) — локальный генератор сообщений и справочник цветов / форматирования.
- Pack Builder (`#builder`) — каркас без интеграции Modrinth, скачивания или подбора зависимостей.
- В sidebar две категории: General с Pack Builder / Colors & Formatting и Checkers со Skin Stealer (`#skin`), Waypoint Color (`#waypoint`), IGN Availability (`#ign`). Категории — заголовки групп, инструменты — отдельные страницы.
- Поиск прямо в sidebar: ввод фильтрует существующее меню, подходящие пункты плавно перемещаются / появляются. Отдельного окна и дублирующей выдачи нет; открытый инструмент не меняется до выбора.

Поиск учитывает названия и функции / синонимы, категорию, регистр / Unicode / пунктуацию, аббревиатуры CF / PB, русские запросы, английский ввод в русской раскладке, пропущенные / лишние / заменённые / переставленные буквы. Примеры: `colour codes`, `minimessgae`, `сборка`, `сщдщкы`. Все значимые слова должны совпасть; точные названия и слова названий выше aliases и приблизительных совпадений. Результаты остаются в своих категориях и ранжируются внутри группы. Пустые группы скрываются на время поиска; при очистке возвращаются обе категории и исходный порядок инструментов. Это локальный детерминированный поиск, без нейросетевого API и отправки запросов в сеть; лимит — 120 символов.

По последнему требованию глобальная горячая клавиша поиска и её подсказка удалены; Ctrl/Cmd+K сайт не перехватывает. Строка доступна кликом / обычным Tab. Стрелки переводят фокус на видимые пункты, Enter в строке открывает лучший результат. Escape сначала очищает запрос, затем возвращает фокус в main / закрывает мобильное меню. Кнопка Clear search очищает строку; при отсутствии результатов — короткое No tools found. Мобильная кнопка Search tools открывает тот же sidebar с фокусом в input. Запрос сохраняется при переходе между инструментами, reload его сбрасывает; скрытые ссылки не входят в Tab-цикл. Иконки инструментов — локальные контурные SVG: коробка у Pack Builder, художественная палитра у Colors & Formatting.

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

Frontend — buildless HTML / CSS / JavaScript ES modules. Для публичных Mojang lookup / PNG добавлен Cloudflare Worker ES module; same-origin API решает CORS и не требует токенов. npm-зависимостей и фреймворка нет. Node.js 22+ для локального сервера / проверок; проверено на Node.js 24.16.0, npm 11.13.0.

- `public/index.html` — каркас, меню с группами General / Checkers, 5 акцентов, inline-строка поиска, раннее восстановление preset.
- `public/styles.css` — Dark Modern, адаптивность от 320 px, стили инструмента и анимации поиска / меню.
- `public/app.js` — маршрутизация, title, темы, звук, мобильное меню, жизненный цикл инструмента.
- `public/formatting.js` — палитра, декорации, RGB, градиенты, сериализаторы и snippets.
- `public/colors-tool.js` — UI, preview, проверка ввода, справочники / копирование, очистка таймеров.
- `public/checker-data.js` — общая валидация имени / UUID и точный Java hash / HSV цвет Waypoint.
- `public/checkers.js` — три UI, запросы / отмена / состояние, preview скина, скачивание PNG, результаты и копирование.
- `public/skin-preview.js` — ленивое 3D-превью, вращение / Front / Back / Reset, resize, остановка и освобождение рендера, 2D fallback.
- `public/icons.js`, `public/icons/lucide.svg` — готовые оригинальные Lucide 1.70.0 SVG; лицензия ISC / Feather MIT рядом.
- `public/vendor/skinview3d/` — официальный UMD skinview3d 3.4.2 (477198 байт), Three.js r156, skinview-utils 0.7.1; исходные лицензии включены. Установка npm / build для preview не требуется; bundle загружается только при показе скина.
- `worker/index.js` — публичный Mojang API adapter и PNG proxy с фиксированными разрешёнными адресами; тот же handleApi использует Node preview.
- `public/tool-catalog.js` — реестр инструментов с полем category, aliases, нормализация / раскладка, ограниченное расстояние редактирования, ранжирование; `searchTools(query, catalog?)` не меняет исходный каталог.
- `public/tool-search.js` — фильтрация / сортировка внутри групп меню, скрытие / восстановление пустых категорий, анимации перемещения / появления, очистка, клавиатура и фокус, синхронизация навигационной подсветки.
- `public/favicon.svg` — знак с зелёным акцентом.
- `scripts/dev.mjs` — локальный HTTP-сервер на loopback, порт 4173 / env PORT.
- `tests/*.test.mjs` — тесты форматирования и поиска на встроенном Node test runner.
- `../wrangler.jsonc` — единственный конфиг: Worker main `./MCStuff/worker/index.js`, assets `./MCStuff/public`, ASSETS binding, SPA fallback, `/api` / `/api/*` через Worker first; имя mcstuff, compatibility date 2026-11-01.
- `../LICENSE` — MIT, Copyright (c) 2026 MCP.

Внешний шрифт Golos Text — Google Fonts, при недоступности используется системный. Иконка Discord встроена в HTML ([Simple Icons](https://github.com/simple-icons/simple-icons/blob/develop/icons/discord.svg)); остальные UI icons — [Lucide 1.70.0](https://github.com/lucide-icons/lucide/tree/1.70.0/icons), оригинальные пути без ручной перерисовки. [skinview3d 3.4.2](https://github.com/bs-community/skinview3d/tree/v3.4.2) взят из официального npm bundle с проверкой SHA-512 пакета. Генератор / поиск внешних API не вызывают.

## Локальная работа и проверка

Skin Stealer получает публичный Java-скин по нику / UUID: вращаемая 3D-модель Classic / Slim / legacy, Front / Back / Reset, drag / zoom / клавиатура, исходная текстура в details и оригинальный PNG для скачивания. Если WebGL недоступен, показывается текстура с фактическим сообщением. Рендер освобождается при уходе / изменении ввода, при скрытой вкладке приостанавливается. При отсутствии custom skin нет вымышленных подстановок. Waypoint Color разрешает ник в UUID или считает UUID без сети; используется UUID.hashCode и HSV brightness 0.9 с точностью Java float. Превью показывает условные Near / Mid / Far размеры маркера. Проверено по ColorHelper клиента 1.21.7, включая Notch #E66185. Team / command / plugin override может менять цвет; Bedrock не поддерживается.

IGN Availability показывает Taken или Not registered по публичному профилю. Ника 3–16 символов без профиля ещё может быть нельзя забрать из-за резерва / cooldown Mojang. Для резервного результата показаны source / verification / cachedAt; отсутствие записи у PlayerDB не является доказательством свободного ника. Точный authenticated availability endpoint требует токен; сайт токены не собирает. Ошибки сети / 429 не выдаются за свободный ник. Checked показывает реальное время запроса.

API: GET / HEAD `/api/player/:nameOrUuid` (профиль и скин), `/api/uuid/:name`, `/api/ign/:name`, `/api/skin/:sha256` (оригинальный PNG). Поиск имени — api.minecraftservices.com, затем api.mojang.com через `/minecraft/profile/lookup/name`; старый users/profiles URL убран после воспроизведённого сбоя на публичном Worker. При отказах Skin / Waypoint используют проверенный [PlayerDB](https://playerdb.co/) profile cache. source / cachedAt возвращаются API и показываются в UI; данные кэша могут быть устаревшими. IGN сначала пробует официальные GET / POST lookup; при их отказе различает Registered (cached) и отсутствие записи без live-подтверждения (registered:null), никогда не называя резервный результат гарантированно свободным ником. 429 не повторяются через другие источники. PNG остаётся оригинальной текстурой textures.minecraft.net с проверкой URL / hash / размера / PNG signature.

Только фиксированные публичные адреса, без аккаунтов / токенов / базы данных / произвольного proxy. Lookup — по submit, состояние в памяти. Client AbortController / requestId защищают от устаревших результатов. Timeout источника 5 s, клиента 30 s. Redirect manual с отказом на 3xx; workerd не поддерживает error mode. UpstreamStatus / upstreamHost в API-ошибке помогают диагностировать edge-only сбои. Для IGN нет кэша; для session / PNG — ограниченный fetch cache.

Из папки MCStuff:

```powershell
npm run dev
npm run check
npm test
```

Адрес: `http://127.0.0.1:4173`. Установка зависимостей и компиляция не нужны. Из корня репозитория подготовка без публикации: `npx wrangler@4.156.1 deploy --dry-run`.

Проверка настоящего Cloudflare runtime из корня: `npx wrangler@4.156.1 dev --local --port 4174 --ip 127.0.0.1`. Node preview вызывает общий handleApi; одна его проверка не заменяет workerd. Пройдены реальные HTTP lookup в workerd: профиль / UUID, занятый и незарегистрированный ник, API 404 и static assets 200. Скачанный через браузер Notch.png (64×32, 526 байт) совпал с оригинальным Mojang texture hash SHA-256. Тесты покрывают 8 Java color vectors, validation, API / 429 / redirects / malformed responses, allowlist, PNG и маршрутизацию.

Пройдены 43 теста: форматирование / цвета / Unicode / JSON, aliases, опечатки и перестановки букв, нормализация Unicode / пунктуации, смысловые запросы, русские aliases / раскладка, релевантность, неизвестные запросы и отсутствие мутаций каталога. Для inline-поиска в браузере проверены фильтрация самого меню без dialog, сохранение открытого текста, неизвестный запрос / Enter, очистка и исходный порядок, переходы / клик в строку / стрелки / Enter, 320 px без переполнения, Tab без скрытых результатов, два Escape и возврат фокуса. Подсветка корректно исчезает / возвращается при фильтрации, консоль без ошибок / предупреждений, title MCStuff. Предыдущая проверка генератора подтвердила clipboard, градиент / стили / JSON, невалидный HEX и внутреннюю прокрутку таблиц.

Переносимая сборка — исходники public и worker, документация, MIT и корневой конфиг с сохранённой структурой MCStuff. Один статический public не обеспечивает сетевые Checkers. Git-метаданные, зависимости, кэши и секреты в архив не включать. Подготовка архива не является публикацией.

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
