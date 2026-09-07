// Self-contained OpenTelemetry bootstrap for Slice & Dice Pizza (U7.1).
//
// This mock app models an independent third-party company integrating with
// OHPP, so its observability depends only on the standard @opentelemetry/*
// packages - exactly as a real Node integrator would wire it. No shared code.
//
// Config-driven and fail-open: the SDK starts only when OTEL_EXPORTER_OTLP_ENDPOINT
// is set (the OTel Collector in dev). When unset - tests, offline - startTelemetry()
// is a no-op and nothing throws.
//
// IMPORTANT: this module is imported first in index.ts so the Node SDK starts
// before express/pg/http are required, letting auto-instrumentation patch them.
// The HTTP instrumentation injects the W3C traceparent header on outbound calls,
// so a pizza-initiated ceremony joins the same cross-service trace as the Resolver.

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-grpc';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | undefined;

export function startTelemetry(serviceName = process.env.OTEL_SERVICE_NAME ?? 'ohpp.pizza'): void {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint || endpoint.trim() === '') {
    return; // telemetry disabled (safe default)
  }

  try {
    sdk = new NodeSDK({
      resource: new Resource({
        [ATTR_SERVICE_NAME]: serviceName,
        [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? '1.0.0',
      }),
      traceExporter: new OTLPTraceExporter({ url: endpoint }),
      metricReader: new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: endpoint }),
      }),
      // Logs -> OTLP -> Collector -> Loki (U7.1 observability parity). Without a
      // log processor the app is invisible in Loki even though it traces/meters.
      logRecordProcessors: [new BatchLogRecordProcessor(new OTLPLogExporter({ url: endpoint }))],
      instrumentations: [
        getNodeAutoInstrumentations({
          // Health checks are noise; keep traces focused on real work.
          '@opentelemetry/instrumentation-fs': { enabled: false },
        }),
      ],
    });

    sdk.start();

    // Bridge console.* to the OTel logs API so existing app logs land in Loki
    // (labelled service_name=<serviceName>) alongside .NET services. Preserves the
    // original console output; fail-open on any emit error.
    bridgeConsoleToOtel(serviceName);

    // Flush on shutdown; never block or throw on exit.
    const shutdown = () => {
      sdk?.shutdown().catch(() => { /* fail-open */ }).finally(() => process.exit(0));
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    // Fail-open: telemetry must never prevent the app from running.
    console.warn('[telemetry] OpenTelemetry failed to start; continuing without it:', err);
  }
}

/**
 * Mirror console.log/info/warn/error into the OpenTelemetry logs pipeline so the
 * app's logs are searchable in Loki, without changing every call site. The
 * original console behaviour is preserved. Fail-open: a logging error never
 * disrupts the app.
 */
function bridgeConsoleToOtel(serviceName: string): void {
  const logger = logs.getLogger(serviceName);
  const severityFor: Record<string, SeverityNumber> = {
    log: SeverityNumber.INFO,
    info: SeverityNumber.INFO,
    warn: SeverityNumber.WARN,
    error: SeverityNumber.ERROR,
  };
  (['log', 'info', 'warn', 'error'] as const).forEach((level) => {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      try {
        logger.emit({
          severityNumber: severityFor[level],
          severityText: level.toUpperCase(),
          body: args
            .map((a) => (typeof a === 'string' ? a : safeStringify(a)))
            .join(' '),
        });
      } catch {
        /* fail-open */
      }
      original(...args);
    };
  });
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
