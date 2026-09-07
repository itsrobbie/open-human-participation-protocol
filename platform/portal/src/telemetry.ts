// Self-contained browser OpenTelemetry for the OHPP Portal SPA (U7.1).
//
// The Portal is a Vite/React single-page app served as static files by nginx;
// there is no server runtime, so telemetry runs in the user's browser and
// exports spans via OTLP/HTTP to the OTel Collector. Depends only on the
// standard @opentelemetry/* browser packages - no shared code.
//
// Config-driven and fail-open: tracing starts only when the endpoint is set via
// Vite env (VITE_OTEL_EXPORTER_OTLP_ENDPOINT, baked at build time). When unset,
// startTelemetry() is a no-op and nothing throws.
//
// The fetch instrumentation injects the W3C traceparent header on same-origin
// calls to the Resolver, so a Portal action joins the same cross-service trace.

import { WebTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-web';
// Note: sdk-trace-web 1.27.0 uses provider.addSpanProcessor(...) rather than a
// constructor `spanProcessors` option (that arrives in a later major).
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

export function startTelemetry(): void {
  const endpoint = import.meta.env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT as string | undefined;
  if (!endpoint || endpoint.trim() === '') {
    return; // telemetry disabled (safe default)
  }

  const serviceName =
    (import.meta.env.VITE_OTEL_SERVICE_NAME as string | undefined) ?? 'ohpp.portal';

  // Verbose OTel diagnostics when explicitly enabled at build time (dev/test).
  if (import.meta.env.VITE_OTEL_DEBUG === '1') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  try {
    const provider = new WebTracerProvider({
      resource: new Resource({
        [ATTR_SERVICE_NAME]: serviceName,
        [ATTR_SERVICE_VERSION]: '1.0.0',
      }),
    });

    provider.addSpanProcessor(
      new BatchSpanProcessor(
        new OTLPTraceExporter({ url: `${endpoint.replace(/\/$/, '')}/v1/traces` }),
      ),
    );

    provider.register({ contextManager: new ZoneContextManager() });

    registerInstrumentations({
      instrumentations: [
        new FetchInstrumentation({
          // Propagate trace context to the Resolver (same-origin API calls).
          propagateTraceHeaderCorsUrls: [/.*/],
          ignoreUrls: [/\/health$/],
        }),
      ],
    });
  } catch (err) {
    // Fail-open: telemetry must never break the app.
    // eslint-disable-next-line no-console
    console.warn('[telemetry] browser OpenTelemetry failed to start; continuing without it:', err);
  }
}

// Initialise on import. Because ES module imports are hoisted and evaluated
// before any inline statement in the importing module, importing this module
// FIRST (before React/router/api-client modules) guarantees the fetch
// instrumentation patches window.fetch before the app can issue any request.
startTelemetry();
