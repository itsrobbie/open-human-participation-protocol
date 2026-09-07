# OHPP observability stack (dev)

This directory holds the local, fully open-source observability stack for the OHPP dev
environment (U7.1). Every service emits OpenTelemetry signals to a single collector, which
fans them out to purpose-built backends, all viewable through one Grafana instance.

Everything here runs with `make dev`. Nothing needs a vendor account or a proprietary key.

## The single pane

Open **Grafana at http://localhost:3001** (dev-only anonymous admin). Two dashboards are
provisioned out of the box:

- **OHPP Overview** (`grafana/provisioning/dashboards/ohpp-overview.json`) - health/metrics
  across services.
- **Follow a ceremony** (`grafana/provisioning/dashboards/follow-a-ceremony.json`) - trace a
  single participation ceremony across services.

The three signal backends are auto-wired as Grafana datasources
(`grafana/provisioning/datasources/datasources.yaml`), with correlation enabled:

| Signal  | Backend    | Grafana datasource | Notes |
|---------|-----------|--------------------|-------|
| Logs    | Loki      | `ohpp-loki`        | A log line links to its trace via `trace_id` (derived field). |
| Traces  | Tempo     | `ohpp-tempo`       | A trace links back to its logs and out to metrics. |
| Metrics | Prometheus| `ohpp-prometheus`  | Default datasource. |

So you can pivot log -> trace -> metric without leaving Grafana.

## How signals flow

```
each service (ohpp.resolver, ohpp.portal, ohpp.bank, ohpp.insurance,
              ohpp.pizza, ohpp.marketplace, ohpp.cli, Flutter client)
        │  OpenTelemetry (traces + metrics + logs)
        ▼
  otel-collector  ── logs ──►  Loki   ─┐
  (otel-collector-  traces ─►  Tempo  ─┼─►  Grafana (http://localhost:3001)
   config.yaml)     metrics►  Prometheus┘
```

- Backend services export OTLP over **gRPC/TLS** to `https://otel-collector:4317`.
- The **browser** (Portal SPA) exports OTLP/**HTTP** to the collector's host port
  `http://localhost:4318` - a documented plaintext dev exception (the browser can't easily
  trust the dev CA root).
- Service naming is `ohpp.<service>` by convention, so services are discoverable across all
  three backends.

Config files in this directory:
- `otel-collector-config.yaml` - receivers (gRPC 4317 TLS, HTTP 4318 plaintext) + pipelines.
- `loki-config.yaml`, `tempo-config.yaml`, `prometheus-config.yaml` - the backends.
- `grafana/provisioning/` - datasources + dashboards (zero click setup).

## Crash reporting and product analytics

These are separate products with their own UIs (they are not part of the Grafana single pane):

- **GlitchTip** (crash/error reporting, Sentry-compatible) - http://localhost:8000. Seeded on
  first run with a fixed dev org/project/DSN (`glitchtip/seed.py`). Part of the default stack.
- **Umami** (product analytics: events, funnels, retention, journeys) - http://localhost:8001
  (login `admin`/`umami`). Opt-in via `make dev-analytics`. Seeded with a fixed website UUID
  (`umami/seed-umami.sh`) so the analytics key is deterministic. Umami replaced PostHog - see
  the deployment-architecture doc for why (PostHog self-host now needs Kafka + ~16GB RAM).

## Documented plaintext exceptions

Everything an OHPP service owns runs over TLS in dev. The exceptions are all
browser-originated or third-party-image hops and are recorded in
`aidlc-docs/construction/u7.1-dev-infrastructure-parity/infrastructure-design/deployment-architecture.md`:

- Browser -> Keycloak login, and browser -> collector OTLP/HTTP (4318): plaintext on localhost
  (the browser can't trust the dev root). The server-to-server equivalents are full TLS.
- GlitchTip / Umami -> Postgres and Redis: TLS but `sslmode=require` / `ssl_cert_reqs=none`
  (encryption without CA verification), since these third-party images don't trust our dev root.
  OHPP's own services use `sslmode=verify-full`.

## Ports

| Service      | URL                     |
|--------------|-------------------------|
| Grafana      | http://localhost:3001   |
| Prometheus   | http://localhost:9090   |
| GlitchTip    | http://localhost:8000   |
| Umami        | http://localhost:8001 (opt-in) |
| OTLP gRPC    | localhost:4317 (TLS)    |
| OTLP HTTP    | localhost:4318 (plaintext, browser) |

Loki (3100) and Tempo (3200) are internal-only; query them through Grafana.

## Adding a new service

New services must be observable to be "complete" - see the
`.kiro/steering/instrumentation-completeness.md` steering rule. In short: emit OTel via the
standard `OTEL_*` env vars, name it `ohpp.<name>`, propagate trace context, keep PII out, route
vendor concerns through the seams, and confirm it shows up in Loki + Tempo + Prometheus.
