/** Protocol constants matching the OHPP specification. */
export const PROTOCOL_VERSION = '1.0';

export const URI_SCHEME = 'ohpp';
export const REGISTER_ACTION = 'register';
export const CHALLENGE_PARAM = 'challenge';

export const WELL_KNOWN_METADATA_PATH = '/.well-known/ohpp/metadata';
export const WELL_KNOWN_APP_METADATA_PATH = '/.well-known/ohpp/app-metadata';

export const MAX_LENGTHS = {
  summary: 200,
  description: 2000,
  rationale: 500,
  category: 50,
  optionLabel: 100,
  transactionLabel: 100,
} as const;

export const MIN_COUNTS = {
  optionsForSelect: 2,
} as const;

export const DEFAULT_METADATA_CACHE_TTL_MS = 300_000; // 5 minutes
export const DEFAULT_TIMEOUT_MS = 30_000; // 30 seconds
export const DEFAULT_CHALLENGE_VALIDITY_MS = 300_000; // 5 minutes
