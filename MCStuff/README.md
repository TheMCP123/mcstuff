# MCStuff

Рабочее пространство Minecraft с Colors & Formatting, тремя Checkers, Pack Builder через Modrinth / Spiget и Bedrock Pattern. Сайт полностью на английском; общение с владельцем и документация — на русском.

## Текущее состояние

- Главная MCStuff со ссылкой на рабочий инструмент.
- Colors & Formatting (`#colors`) — памятка по цветам / кодам / форматированию с копированием примеров.
- Pack Builder (`#builder`) — рабочий сборщик Plugins / Mods / Resource packs / Data packs: поиск Modrinth / SpigotMC через Spiget, автоматические обязательные зависимости, выбор файлов, отдельные загрузки и ZIP. CurseForge adapter подготовлен, нужен серверный ключ.
- В sidebar три категории: General с Pack Builder / Colors & Formatting; Checkers со Skin Stealer (`#skin`), Waypoint Color (`#waypoint`), IGN Availability (`#ign`); Base Finding с Bedrock Pattern (`#bedrock`). Категории — заголовки групп, инструменты — отдельные страницы.
- Bedrock Pattern — поиск координат по известному seed и горизонтальному рисунку bedrock 10 × 10 в заданном радиусе.
- Поиск прямо в sidebar: ввод фильтрует существующее меню, подходящие пункты плавно перемещаются / появляются. Отдельного окна и дублирующей выдачи нет; открытый инструмент не меняется до выбора.

Поиск учитывает названия и функции / синонимы, категорию, регистр / Unicode / пунктуацию, аббревиатуры CF / PB, русские запросы, английский ввод в русской раскладке, пропущенные / лишние / заменённые / переставленные буквы. Примеры: `colour codes`, `minimessgae`, `сборка`, `сщдщкы`, `base finding`, `бедрок`. Все значимые слова должны совпасть; точные названия и слова названий выше aliases и приблизительных совпадений. Результаты остаются в своих категориях и ранжируются внутри группы. Пустые группы скрываются на время поиска; при очистке возвращаются все категории и исходный порядок инструментов. Это локальный детерминированный поиск, без нейросетевого API и отправки запросов в сеть; лимит — 120 символов.

По последнему требованию глобальная горячая клавиша поиска и её подсказка удалены; Ctrl/Cmd+K сайт не перехватывает. Строка доступна кликом / обычным Tab. Стрелки переводят фокус на видимые пункты, Enter в строке открывает лучший результат. Escape сначала очищает запрос, затем возвращает фокус в main / закрывает мобильное меню. Кнопка Clear search очищает строку; при отсутствии результатов — короткое No tools found. Мобильная кнопка Search tools открывает тот же sidebar с фокусом в input. Запрос сохраняется при переходе между инструментами, reload его сбрасывает; скрытые ссылки не входят в Tab-цикл. Иконки инструментов — локальные контурные SVG: коробка у Pack Builder, художественная палитра у Colors & Formatting.

Общие отступы всех вкладок: h1 padding-bottom 24px, контент через --section-gap 28px, scrollbar-gutter stable исключает скачки между короткими и длинными страницами. Нижний padding sidebar 10px, цвета / Discord опущены на 18px. Убраны Message builder, Click a code to copy и повторные подсказки Skin; ограничения форматов / кэша сохранены.

Название вкладки всегда строго `MCStuff`. Бренд в sidebar / мобильной шапке целиком Bold 700 (Golos Text). Главная открывается без hash и по клику на бренд; старые `#overview`, `#resources`, `#tools` открывают главную. Подсветка меню скользит, страницы переключаются мгновенно.

Modern: по умолчанию Dark (#101113 / #151619), дополнительно Light (#f6f7f9 / #ffffff). Над цветами две Lucide-иконки солнца / луны 14px / stroke 1.75, кнопки 22 × 28px / gap 2px слева над первыми двумя цветами. Фон отсутствует и при hover, и у выбранного режима; состояние обозначается цветом иконки. До цветов — 4px. Иконки не вращаются при hover / клике; при переключении — crossfade оформления и звук, aria-pressed / клавиатура. Режим независимо сохраняется в mcstuff-appearance, восстанавливается до CSS; системная тема не меняет default. Цвета / формы / popup / ошибки и status badges поддерживают оба режима. Акценты Green (default), Blue, Yellow, Red, Purple хранятся отдельно в mcstuff-theme. --accent-text наследует исходный --accent в обоих режимах без затемняющего / обесцвечивающего смешивания. Цвета 22 × 28px / gap 2px и Discord справа сохраняют нижнее положение.

По последнему требованию свой акцент сайта удалён. Ранний скрипт восстанавливает preset из `mcstuff-theme` до CSS, старые Amber / Rose отображает как Yellow / Red. Старый режим custom заменяет на Green, `mcstuff-custom-accent` удаляет. HEX-коды памятки относятся к цветам Minecraft.

Звук акцента — sine, 760 → 580 Hz, 70 ms; навигации — triangle, 440 → 300 Hz, 50 ms. Режим: Light sine 540 → 810 Hz, Dark 690 → 460 Hz, 80ms. Все используют gain 0.025 и один ленивый AudioContext. Повторный выбор, reload и Discord без звука; ошибки аудио не блокируют интерфейс. Анимации меню / поиска по требованию пользователя не отключаются автоматически при prefers-reduced-motion.

## Colors & Formatting

По последнему требованию это памятка: 16 цветов Minecraft Java с HEX, Legacy & / § и MiniMessage; пять декораций и reset с открывающими / закрывающими тегами. Отдельно показаны примеры MiniMessage / Legacy / HEX / BungeeCord RGB / JSON (Java), а также готовые MiniMessage snippets: gradient, rainbow, transition, shadow, hover / click, font, newline, keybind, translation, insertion и выключение стиля.

Генератор, текстовые поля, пикеры, preview / result и интерактивные стили удалены. Имена цветов статические; коды и примеры копируются кликом. Примеры выводятся через textContent. Уведомление Copied появляется после успешной записи; при отказе выделяется код для ручного копирования. Состояния сообщения и obfuscation timer больше нет; таймер уведомления освобождается при уходе.

Синтаксис выбирается по поддержке плагина / config field. Legacy ограничен своими цветами / декорациями; цвет сбрасывает стили, hover / click отсутствуют. Поддержка RGB зависит от serializer. В strict MiniMessage теги закрываются в обратном порядке, reset запрещён. Все реальные образцы HEX остаются одинаковыми при смене режима и акцента.

Основные источники: [MiniMessage format](https://docs.papermc.io/adventure/minimessage/format/) и [Legacy serializer](https://docs.papermc.io/adventure/serializer/legacy/).

## Bedrock Pattern v1

Base Finding → Bedrock Pattern (`#bedrock`). Горизонтальная сетка 10 × 10: Bedrock / Other / Unknown, кисть с протягиванием, Fill other, Clear pattern и управление клавиатурой. Unknown не участвует в сравнении; Other означает, что на этой высоте bedrock отсутствует. Нужно минимум 8 известных клеток; больше известных клеток уменьшает количество случайных совпадений. По умолчанию Y=-61 — третий блок над сплошным нижним слоем Y=-64; доступны Y=-63, -62, -61, -60.

Поддержка подтверждена для неизменённого vanilla Overworld **Java 1.21.11 / 26.3**. Это не поиск для Bedrock Edition / Nether, изменённых генераторов или старого retrogen. Числовой seed читается как signed 64-bit BigInt без потери точности. Движок воспроизводит named positional factory `minecraft:bedrock_floor`, Java int / long overflow и Xoroshiro128++ / strict nextFloat threshold, затем сравнивает все известные клетки. Четыре поворота включены по умолчанию; одинаковые симметричные ориентации не дублируются. X/Z результата — северо-западный угол всей области 10 × 10, Y — выбранный слой, угол — поворот по часовой стрелке от введённой сетки.

Поиск ограничен квадратом Center X/Z ± Radius, радиус 0…8192 блоков, по умолчанию 512. Полный перебор мира не реализован; отсутствие совпадений означает только отсутствие в проверенной области. Все вычисления идут локально в module Worker / WASM: прогресс, число проверенных позиций, время, Stop и копирование реальных координат. При 100 совпадениях поиск останавливается с явным сообщением о лимите. Seed / сетка / результаты хранятся в памяти, не отправляются на сервер и не сохраняются в localStorage. Уход завершает Worker, редактирование очищает устаревшие результаты. При недоступном Clipboard API выделяются только координаты для ручного копирования.

Собственная реализация MCStuff, без заимствования GPL-кода. Эталонные фикстуры `tests/fixtures/bedrock-1.21.11.json` и `bedrock-26.3.json` получены через реальные vanilla RNG: 504 отсчёта, 14 сеток, отрицательные / переполняющие координаты и границы 64-bit seed. Правила Overworld / пороги отдельно сверены с конфигурацией и классами этих серверов. Это проверка генератора случайных значений и material rules, не тест полной генерации чанка в игре.

Опциональный helper `scripts/reference/BedrockReference.java` запускается JDK 25 с официальным серверным JAR / его библиотеками в classpath; аргументы — выходной JSON и `mapped` только для 26.3 (для 1.21.11 без второго аргумента). SHA-1 официальных серверов: 1.21.11 `64bb6d763bed0a9f1d632ec347938594144943ed`, 26.3 `33680f5f2ac32864d6d7cf5e56a705fdb3e05f4c`. Игровые JAR / библиотеки не входят в проект; локальный reference cache остаётся в ignored `.wrangler/bedrock-reference/`.

## Технологии и файлы

Выбор версий в Builder использует общие кастомные контролы вместо OS popup. Общий компонент выбора цвета сохранён, но на странице Colors не отображается. Длинные списки имеют поиск; доступны клавиатура / ARIA, HSV plane / sliders / HEX, закрытие по Escape / клику снаружи и очистка при уходе. Checkbox, progress, scrollbars, раскрывающиеся блоки и подсказки поддерживают Dark / Light. В Pack Builder увеличены кнопки, выровнены фильтры / карточки, список файлов прокручивается отдельно от Download; на мобильном Your pack свёрнут, ошибки раскрывают панель. Переход между инструментами мгновенно возвращает страницу наверх.

Frontend — buildless HTML / CSS / JavaScript ES modules и готовый WASM Bedrock Pattern. Для публичных Mojang lookup / PNG добавлен Cloudflare Worker ES module; same-origin API решает CORS и не требует токенов. Runtime npm-зависимостей и фреймворка нет. Только devDependencies: WABT 1.0.39 для воспроизводимой сборки WASM, Happy DOM 21.0.4 для DOM-тестов; версии и package-lock.json закреплены. Node.js 22+ для локального сервера / проверок; проверено на Node.js 24.16.0, npm 11.13.0.

- `public/index.html` — каркас, меню General / Checkers / Base Finding, 5 акцентов, inline-строка поиска, раннее восстановление preset.
- `public/styles.css` — Dark / Light Modern, адаптивность от 320 px, стили инструмента и анимации поиска / меню.
- `public/form-controls.js`, `form-controls.css` — общие select / color picker, tooltips / disclosure и оформление полей; MutationObserver отслеживает динамические варианты, dispose освобождает popup / обработчики. `refreshFormControls(host)` синхронизирует программные value / disabled.
- `public/control-data.js`, `tests/control-data.test.mjs` — HSV / HEX, фильтрация вариантов, клавиатурная навигация и позиционирование в viewport; пять тестов.
- `public/app.js` — маршрутизация, title, темы, звук, мобильное меню, жизненный цикл инструмента.
- `public/formatting.js` — палитра, декорации, RGB, градиенты, сериализаторы и snippets.
- `public/colors-tool.js` — памятка, таблицы / примеры и копирование, без генератора; очистка таймера уведомления.
- `public/checker-data.js` — общая валидация имени / UUID и точный Java hash / HSV цвет Waypoint.
- `public/checkers.js` — Skin / Waypoint UI, запросы / отмена / состояние, 3D / Locator Bar preview и копирование.
- `public/ign-tool.js`, `public/ign-data.js` — Single / Bulk IGN, валидация, очередь, отмена / 429, TSV и переход к скину.
- `public/bedrock-tool.js`, `bedrock-data.js`, `bedrock-worker.js` — редактор сетки, валидация / seed / повороты, фоновый поиск / прогресс / остановка.
- `engine/bedrock.wat`, `public/bedrock-engine.wasm`, `scripts/build-bedrock.mjs` — собственный точный matcher и его готовый артефакт; WASM хранится в Git, обычный deploy не требует компиляции.
- `tests/bedrock-*.test.mjs`, `tests/fixtures/`, `scripts/bedrock-test-worker.mjs`, `scripts/reference/BedrockReference.java` — vanilla-векторы, реальный Worker через Node adapter, редактор / результаты / clipboard и опциональный генератор фикстур.
- `public/textures/minecraft/` — оригинальные Locator Bar PNG, nine-slice metadata и NOTICE с provenance / hashes.
- `public/skin-preview.js` — ленивое 3D-превью, вращение / Front / Back / Reset, resize, остановка и освобождение рендера, 2D fallback.
- `public/icons.js`, `public/icons/lucide.svg` — готовые оригинальные Lucide 1.70.0 SVG; лицензия ISC / Feather MIT рядом.
- `public/vendor/skinview3d/` — официальный UMD skinview3d 3.4.2 (477198 байт), Three.js r156, skinview-utils 0.7.1; исходные лицензии включены. Установка npm / build для preview не требуется; bundle загружается только при показе скина.
- `worker/index.js` — router Checkers / Builder, Mojang adapter и PNG proxy; Node использует тот же handleApi.
- `worker/pack-api.js` — Modrinth / Spiget / CurseForge adapters, metadata / search / versions / dependency resolution / потоковая загрузка.
- `public/pack-builder.js`, `pack-data.js`, `pack-export.js`, `pack-zip.js` — UI, модель / draft, integrity / export и ZIP STORE без npm-зависимостей.
- `../.dev.vars.example` — только имя optional server secret; реальный .dev.vars игнорируется Git.
- `public/tool-catalog.js` — реестр инструментов с полем category, aliases, нормализация / раскладка, ограниченное расстояние редактирования, ранжирование; `searchTools(query, catalog?)` не меняет исходный каталог.
- `public/tool-search.js` — фильтрация / сортировка внутри групп меню, скрытие / восстановление пустых категорий, анимации перемещения / появления, очистка, клавиатура и фокус, синхронизация навигационной подсветки.
- `public/favicon.svg` — знак с зелёным акцентом.
- `scripts/dev.mjs` — локальный HTTP-сервер на loopback, порт 4173 / env PORT.
- `tests/*.test.mjs` — тесты форматирования, поиска, API / Builder и Bedrock Pattern на встроенном Node test runner; DOM-тесты используют Happy DOM.
- `../wrangler.jsonc` — единственный конфиг: Worker main `./MCStuff/worker/index.js`, assets `./MCStuff/public`, ASSETS binding, SPA fallback, `/api` / `/api/*` через Worker first; имя mcstuff, compatibility date 2026-11-01.
- `../LICENSE` — MIT, Copyright (c) 2026 MCP.

Внешний шрифт Golos Text — Google Fonts, при недоступности используется системный. Иконка Discord встроена в HTML ([Simple Icons](https://github.com/simple-icons/simple-icons/blob/develop/icons/discord.svg)); остальные UI icons — [Lucide 1.70.0](https://github.com/lucide-icons/lucide/tree/1.70.0/icons), оригинальные пути без ручной перерисовки; Bedrock Pattern использует scan-search. [skinview3d 3.4.2](https://github.com/bs-community/skinview3d/tree/v3.4.2) взят из официального npm bundle с проверкой SHA-512 пакета. Форматирование / поиск меню / Bedrock Pattern внешних API не вызывают.

## Локальная работа и проверка

Skin Stealer получает публичный Java-скин по нику / UUID: вращаемая 3D-модель Classic / Slim / legacy, Front / Back / Reset, drag / zoom / клавиатура, исходная текстура в details и оригинальный PNG для скачивания. Если WebGL недоступен, показывается текстура с фактическим сообщением. Рендер освобождается при уходе / изменении ввода, при скрытой вкладке приостанавливается. При отсутствии custom skin нет вымышленных подстановок. Waypoint Color разрешает ник в UUID или считает UUID без сети; используется UUID.hashCode и HSV brightness 0.9 с точностью Java float. Превью использует оригинальные locator_bar_background и четыре default_0…3 из официального Minecraft Java 26.1.1. SHA-1 клиента проверен, PNG не изменены; provenance / SHA-256 и авторство Mojang / Microsoft в public/textures/minecraft/NOTICE.txt. Фон nine-slice 12×5 с borders 5/5/1/1, масштаб 2×; 9×9 markers с sRGB tint, исходной обводкой / альфой. Игровые assets не входят под MIT. Проверено по ColorHelper клиента 1.21.7, включая Notch #E66185. Team / command / plugin override может менять цвет; Bedrock не поддерживается.

IGN Availability показывает Taken или Not registered по публичному профилю. Ника 3–16 символов без профиля ещё может быть нельзя забрать из-за резерва / cooldown Mojang. Для резервного результата показаны source / verification / cachedAt; отсутствие записи у PlayerDB не является доказательством свободного ника. Точный authenticated availability endpoint требует токен; сайт токены не собирает. Ошибки сети / 429 не выдаются за свободный ник. Checked показывает реальное время запроса. Single — один ник, Bulk — до 10 уникальных имён через newline / comma / semicolon / whitespace, дубликаты без учёта регистра. Локальная валидация не обрезает длинный ник. Очередь максимум 2×, Stop / редактирование / уход отменяют запросы и отбрасывают поздние ответы; 429 останавливает очередь. Copy results даёт TSV со статусом / source / UUID / cachedAt / checkedAt; UUID копируется отдельно, View skin передаёт его в Skin Stealer без автоматического запроса. Кэш отмечается Registered (cached), отсутствие подтверждения — Unconfirmed.

API: GET / HEAD `/api/player/:nameOrUuid` (профиль и скин), `/api/uuid/:name`, `/api/ign/:name`, `/api/skin/:sha256` (оригинальный PNG). Поиск имени — api.minecraftservices.com, затем api.mojang.com через `/minecraft/profile/lookup/name`; старый users/profiles URL убран после воспроизведённого сбоя на публичном Worker. При отказах Skin / Waypoint используют проверенный [PlayerDB](https://playerdb.co/) profile cache. source / cachedAt возвращаются API и показываются в UI; данные кэша могут быть устаревшими. IGN сначала пробует официальные GET / POST lookup; при их отказе различает Registered (cached) и отсутствие записи без live-подтверждения (registered:null), никогда не называя резервный результат гарантированно свободным ником. 429 не повторяются через другие источники. PNG остаётся оригинальной текстурой textures.minecraft.net с проверкой URL / hash / размера / PNG signature.

Только фиксированные публичные адреса, без аккаунтов / токенов / базы данных / произвольного proxy. Lookup — по submit, состояние в памяти. Client AbortController / requestId защищают от устаревших результатов. Timeout источника 5 s, клиента 30 s. Redirect manual с отказом на 3xx; workerd не поддерживает error mode. UpstreamStatus / upstreamHost в API-ошибке помогают диагностировать edge-only сбои. Для IGN нет кэша; для session / PNG — ограниченный fetch cache.

Из папки MCStuff:

```powershell
npm run dev
npm run check
npm ci
npm test
npm run build:bedrock
```

Адрес: `http://127.0.0.1:4173`. Для preview и deploy установка зависимостей / сборка не нужны: готовый WASM включён в public. `npm ci` нужен перед тестами / пересборкой WASM. `npm run build:bedrock` выполнять после изменения WAT; тест сравнивает результат компиляции с включённым бинарным файлом. Из корня репозитория подготовка без публикации: `npx wrangler@4.156.1 deploy --dry-run`.

Проверка настоящего Cloudflare runtime из корня: `npx wrangler@4.156.1 dev --local --port 4174 --ip 127.0.0.1`. Node preview вызывает общий handleApi; одна его проверка не заменяет workerd. Пройдены реальные HTTP lookup в workerd: профиль / UUID, занятый и незарегистрированный ник, API 404 и static assets 200. Скачанный через браузер Notch.png (64×32, 526 байт) совпал с оригинальным Mojang texture hash SHA-256. Тесты покрывают 8 Java color vectors, validation, API / 429 / redirects / malformed responses, allowlist, PNG и маршрутизацию.

Для Bedrock Pattern пройдены 98 тестов и syntax check: vanilla-векторы, точный поиск сеток, повороты / Unknown / Other / границы, соответствие WASM исходнику, реальный Worker, DOM-редактор / результаты / точное содержимое копирования и fallback, Stop / уход. DOM не доказывает визуальную корректность desktop / mobile; новая нативная визуальная проверка в этой среде недоступна. Предыдущая браузерная проверка памятки, тем и Builder, сетевых функций и ZIP относится к прежним изменениям и отмечена в changelog; не считать её проверкой новой страницы Bedrock Pattern.

Wrangler 4.156.1 dry-run подготовил Worker и 44 assets; локальные HTTP-проверки подтвердили новые модули / WASM 200, правильный MIME и совпадение байтов движка. Публикация Bedrock Pattern разрешена отдельной командой владельца. Успешные локальные проверки не заменяют проверку Workers Builds текущего commit и опубликованных файлов.

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

Первые версии Pack Builder и Bedrock Pattern реализованы. Следующие изменения — по обратной связи пользователя; не добавлять обещания будущих функций в интерфейс. Глобальный поиск bedrock за пределами выбранной области требует отдельного вычислительного решения.

Проект распространяется под MIT; внешние материалы сохраняют свои условия. Подробная история решений — CHANGELOG.md, постоянные требования — AGENTS.md.

## Pack Builder v1

Четыре типа: Plugins (Paper / Purpur / Spigot / Bukkit / Folia / Velocity / BungeeCord), Mods (Fabric / NeoForge / Forge / Quilt), Resource packs и Data packs (Vanilla). Minecraft releases запрашиваются у Modrinth при загрузке, default — самый новый по дате API. Фильтры не меняют тёмный layout / темы. Search — Modrinth или все доступные каталоги, SpigotMC только для Plugins; query / сортировка / Load more / pre-release files. SpigotMC использует community [Spiget](https://spiget.org/about/), не официальный API. Tested versions проекта не подтверждают конкретный файл: Compatibility unverified, зависимости нужно проверить вручную.

Добавление выбирает новый совместимый release; другие совместимые версии доступны у root в списке. Обязательные зависимости Modrinth / CurseForge добавляются рекурсивно, optional / embedded не устанавливаются, pinned IDs учитываются. Конфликты версий / incompatible dependencies / дубли filename или названия из разных каталогов блокируются. Смена версии атомарная; используемую зависимость нельзя удалить отдельно, orphan automatic dependencies удаляются с root. До 50 проектов; один dependency graph до 16 узлов / 8 уровней / 44 upstream-запросов. Циклические зависимости — ошибка.

Draft в localStorage mcstuff-pack-v1 содержит выбранный контекст / имя / metadata без ключей, иконок, URLs файлов или binary. Внутри сессии отдельные выборки по type / mc / loader, активный draft восстанавливается после reload с валидацией. Отмена поиска / ухода не применяет поздние ответы. Name / Add / version / remove защищены от изменения в ходе ZIP download.

Каждый файл можно скачать отдельно. Download ZIP скачивает максимум два файла одновременно, проверяет ZIP/JAR magic, размер и SHA-512 / SHA-1, затем сохраняет исходные байты в plugins/, mods/, resourcepacks/ или datapacks/. ZIP STORE UTF-8 / CRC-32, manifest mcstuff-pack.json. Не скачавшиеся / внешние / запрещённые автором файлы перечислены в MANUAL_DOWNLOADS.txt с реальными source links; UI показывает сколько включено и сколько требует ручной загрузки. При нуле файлов ZIP не создаётся для пользователя. Cancel не выдаёт partial archive. Ограничения v1: 64MB / файл, 128MB / ZIP; большие файлы нужно брать на source page. Mods ZIP не является .mrpack / готовой установкой launcher, loader / configs / assets Minecraft не включаются. Export list — JSON manifest, импорта в v1 нет.

API GET / HEAD /api/builder/meta, /search, /versions, /download; POST /api/builder/resolve с same-origin JSON до 16KB. Search принимает type / mc / loader / q / source / sort / page; versions / download — source / project / version плюс контекст. Произвольные URL клиента не используются: Worker получает канонический файл из каталога, проверяет фиксированные CDN и каждый redirect. Proxy потоковый, x-api-key не передаётся на CDN. JSON timeout 8s / общий 45s, partial search сохраняет живые источники.

CurseForge пока без ключа по ответу пользователя: реализован adapter официального [API](https://docs.curseforge.com/rest-api/), source option честно показывает API key required. Нужен secret CURSEFORGE_API_KEY в Cloudflare Worker; локально — root .dev.vars (образец .dev.vars.example). Ключ не вводится в браузер и не попадает в Git / manifests / логи. Классы Minecraft ищутся через categories, Forge / Fabric / Quilt / NeoForge — по API enum; allowModDistribution:false / отсутствующий downloadUrl оставляет ручную загрузку. Live CurseForge без ключа не проверен; контракт и ограничения проверены фикстурами.

Проверены реальные Modrinth поиски / resolve четырёх типов и Spiget resources. В Node и workerd получены совместимые plugin / mod / resource-pack / data-pack файлы. Реальный ZIP Mod Menu + Fabric API + Text Placeholder API (3 658 281 bytes) открыт независимым .NET ZIP reader, SHA-512 всех трёх JAR совпали с API; браузерный экспорт показал 3 included. Публикация выполняется по отдельной команде пользователя; новые production-маршруты проверяются после успешного Workers Build.
