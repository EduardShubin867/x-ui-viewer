# Xray Scope

Self-hosted панель для realtime-дебага клиентских подключений Xray/3x-ui. Collector читает `access.log` без загрузки файла целиком, нормализует строки и отправляет их в защищённый Next.js API. PostgreSQL хранит историю, SSE доставляет новые события в браузер.

> **Приватность:** сервис сохраняет историю сетевых назначений пользователей: email клиента, source IP, домен/IP назначения, порт, inbound/outbound, raw-строку и время. Ограничьте доступ, задайте retention и соблюдайте применимое законодательство. Сервис не читает содержимое HTTP-запросов, не расшифровывает TLS и не знает объём трафика по доменам.

## Возможности

- desktop-first тёмная live-таблица с фильтрами, pause/resume, копированием и деталями;
- страницы клиентов с топами за 5 минут/час, TCP/UDP, outbound и IP-only событиями;
- временная debug-сессия на 5/10/30/60 минут;
- cursor pagination, агрегаты и SSE heartbeat;
- дедупликация по детерминированному SHA-256 `eventId`;
- collector с offset/inode state, rotation/truncation detection, локальной bounded-очередью и exponential backoff;
- изолированный адаптер 3x-ui и синхронизация клиентов;
- Basic Auth панели, отдельный collector token, Zod validation, body limit и rate limiting;
- cron-compatible retention-команда.

## Быстрый запуск

Требования: Docker Engine и Compose v2.

```bash
cp .env.example .env
```

В `.env` обязательно замените `POSTGRES_PASSWORD`, `PANEL_PASSWORD`, `COLLECTOR_TOKEN`, задайте `NODE_ID` и абсолютный `XRAY_LOG_DIR`. Сгенерировать токен можно так:

```bash
openssl rand -hex 32
docker compose up -d --build
docker compose ps
curl http://localhost:3000/api/health
```

Панель откроется на `http://localhost:3000` и запросит `PANEL_USERNAME` / `PANEL_PASSWORD`.

## Настройка Xray access log

В конфигурацию Xray добавьте:

```json
{
  "log": {
    "access": "./access.log",
    "error": "./error.log",
    "loglevel": "warning",
    "dnsLog": false,
    "maskAddress": ""
  }
}
```

Путь должен совпадать с фактической директорией, которую монтирует collector. У процесса Xray должны быть права записи, у collector достаточно read-only доступа. Перезапустите Xray и проверьте:

```bash
tail -F /path/to/xray/logs/access.log
```

### Sniffing

В каждом нужном inbound включите sniffing:

```json
{
  "enabled": true,
  "destOverride": ["http", "tls", "quic"],
  "routeOnly": true
}
```

Sniffing извлекает домен из доступных HTTP Host, TLS SNI или QUIC metadata. Домен может остаться неизвестным при прямом IP-соединении, ECH, нестандартном протоколе, отсутствии SNI, неподдерживаемом QUIC или когда трафик нельзя уверенно классифицировать. В таком случае панель покажет destination IP. `routeOnly` не меняет исходное назначение для проксирования сверх нужд маршрутизации.

В 3x-ui задайте **уникальный email каждому клиенту**. Именно поле `email:` связывает access event с человеком/устройством; одинаковые или пустые email делают атрибуцию неоднозначной. Практичный формат: `person-device`, например `eduard-phone`.

## Подключение первого 3x-ui узла

Collector автоматически создаст узел с именем, равным `NODE_ID`, когда придёт первое событие. Чтобы сразу добавить URL панели и серверный token, выполните защищённый запрос:

```bash
curl -u "$PANEL_USERNAME:$PANEL_PASSWORD" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Finland 1",
    "slug": "finland-1",
    "panelUrl": "https://panel.example.com",
    "panelBasePath": "/secret-path",
    "apiToken": "replace-me"
  }' \
  http://localhost:3000/api/nodes
```

Запрос идемпотентен по `slug`: если узел уже создал collector, он обновит конфигурацию панели. Получите `id` через `GET /api/nodes`, затем запустите sync:

```bash
curl -u "$PANEL_USERNAME:$PANEL_PASSWORD" -X POST http://localhost:3000/api/nodes/NODE_DATABASE_ID/sync
```

Конкретные endpoints разных версий 3x-ui собраны в `lib/server/three-xui/client.ts`. Текущий адаптер ожидает Bearer token. Некоторые сборки 3x-ui поддерживают только cookie login — для них потребуется отдельный auth adapter. Token никогда не попадает в public JSON или client bundle. В MVP он хранится в БД открытым текстом; для production с повышенными требованиями его следует шифровать at rest.

## Collector отдельно от web

Предпочтительно монтировать **всю директорию** логов — это корректнее переживает rename-based rotation:

```yaml
volumes:
  - /path/to/xray/logs:/var/log/xray:ro
  - collector-data:/data
```

Bind mount одного файла может продолжить указывать на старый inode после rotation:

```yaml
volumes:
  - /path/to/xray/access.log:/var/log/xray/access.log:ro
```

Для обычного Node.js-процесса:

```bash
pnpm install
XRAY_ACCESS_LOG_PATH=/var/log/xray/access.log \
NODE_ID=finland-1 \
WEB_API_URL=https://scope.example.com \
COLLECTOR_TOKEN=... \
COLLECTOR_BATCH_SIZE=100 \
COLLECTOR_FLUSH_INTERVAL_MS=1000 \
COLLECTOR_STATE_PATH=/var/lib/xray-scope/collector-state.json \
pnpm collector:dev
```

`collector-state.json` содержит inode, byte offset, незавершённую строку и локальную очередь. Состояние пишется атомарно. При неопределённом результате HTTP collector может повторить batch; уникальный `eventId` делает повтор безопасным. Время Xray log не содержит timezone, поэтому parser интерпретирует его в локальной timezone collector. Установите контейнеру/процессу ту же timezone, что и Xray.

## Проверка событий

```bash
docker compose logs -f collector web
curl -u "$PANEL_USERNAME:$PANEL_PASSWORD" 'http://localhost:3000/api/events?limit=10'
```

Можно отправить тестовое событие напрямую в collector API; `nodeId` — slug узла:

```bash
curl -H "Authorization: Bearer $COLLECTOR_TOKEN" -H 'Content-Type: application/json' \
  -d '{"eventId":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef","occurredAt":"2026-07-15T18:13:04.000Z","nodeId":"finland-1","clientEmail":"eduard","sourceIp":"1.2.3.4","network":"tcp","destinationHost":"api.openai.com","destinationIp":null,"destinationPort":443,"detectedDomain":null,"inboundTag":"inbound-443","outboundTag":"direct","rawLine":"test"}' \
  http://localhost:3000/api/collector/events
```

## Retention

Команда идемпотентно удаляет detail events старше `EVENT_RETENTION_HOURS` (по умолчанию 72):

```bash
docker compose exec web pnpm cleanup:events
```

Пример cron на хосте:

```cron
17 * * * * cd /opt/xray-scope && docker compose exec -T web pnpm cleanup:events
```

## Локальная разработка

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres
pnpm prisma:generate
pnpm prisma:migrate
pnpm dev
```

Проверки:

```bash
pnpm test
pnpm lint
pnpm build
pnpm collector:build
```

## API

- `POST /api/collector/events` — single event или `{ events: [...] }`, максимум 500;
- `GET /api/events` — `nodeId`, `clientEmail`, `search`, `network`, `inboundTag`, `outboundTag`, `from`, `to`, `limit`, `cursor`;
- `GET /api/events/stream` — SSE `ready`, `access-event`, `resync-required`;
- `GET/POST /api/nodes` — безопасное public-представление / создание узла;
- `POST /api/nodes/:id/sync` — sync 3x-ui;
- `GET /api/clients`, `GET /api/stats`, `GET /api/health`.

## Архитектура и ограничения

Domain schema, Prisma repository, ingestion service и realtime transport разделены. In-memory transport — сменный singleton за `AccessEventTransport`; для нескольких web-реплик замените его на PostgreSQL `LISTEN/NOTIFY`, Redis Pub/Sub или NATS. PostgreSQL остаётся source of truth, UI перечитывает snapshot при SSE reconnect/gap. Между DB commit и transient publish есть crash window; строгая доставка потребует transactional outbox.

Ограничения MVP:

- SSE fan-out работает в пределах одного web-процесса;
- rate limiter хранится в памяти процесса;
- Basic Auth подходит для небольшого закрытого deployment, но не заменяет SSO/RBAC;
- 3x-ui auth/endpoints отличаются между версиями, текущий адаптер рассчитан на Bearer token;
- API-токен 3x-ui пока не зашифрован at rest;
- статистика ограничена последними 20 000 событиями выбранного периода;
- UI редактирования узла и durable debug sessions отсутствуют;
- access log не содержит байты по доменам, поэтому сервис их не оценивает.
