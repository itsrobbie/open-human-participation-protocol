// Domain - Types, interfaces, constants
export type {
  RequestType,
  RequestStatus,
  ResolutionMethod,
  SignatureAlgorithm,
  ParticipationRequest,
  ActionInfo,
  RequestOption,
  InputValidation,
  TransactionInfo,
  SendRequestParams,
  SendResult,
  StatusResult,
  CancelResult,
  VerificationResult,
  AttestationEnvelope,
  ParticipationAttestation,
  DecisionInfo,
  ResolutionInfo,
  SignatureInfo,
  RegistrationChallenge,
  RegistrationCredentials,
  ServiceMetadata,
  ServiceEndpoints,
  AppMetadata,
  JwkSet,
  Jwk,
} from './domain/types.js';

export type { CredentialStore } from './domain/interfaces.js';
export type { OhppClientOptions } from './domain/config.js';

export {
  PROTOCOL_VERSION,
  URI_SCHEME,
  REGISTER_ACTION,
  CHALLENGE_PARAM,
  WELL_KNOWN_METADATA_PATH,
  WELL_KNOWN_APP_METADATA_PATH,
  MAX_LENGTHS,
  MIN_COUNTS,
} from './domain/constants.js';

// Services
export { OhppRequesterClient } from './services/ohpp-requester-client.js';
export { ChallengeGenerator } from './services/challenge-generator.js';
export { CallbackHandler } from './services/callback-handler.js';
export { validateRequest } from './services/request-validator.js';

// Infrastructure (test utilities)
export { InMemoryCredentialStore } from './infrastructure/in-memory-credential-store.js';
