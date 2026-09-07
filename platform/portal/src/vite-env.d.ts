/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_PROTOCOL_LAB?: string
  readonly VITE_OTEL_EXPORTER_OTLP_ENDPOINT?: string
  readonly VITE_OTEL_SERVICE_NAME?: string
  readonly VITE_OTEL_DEBUG?: string
}
