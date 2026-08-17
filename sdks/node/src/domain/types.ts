/**
 * OHPP Node SDK - Domain Types
 *
 * These types define the protocol's wire format and the SDK's public API surface.
 * They mirror the protocol specification exactly.
 */

// --- Request Types ---

export type RequestType =
  | 'select'
  | 'multiselect'
  | 'text'
  | 'number'
  | 'date'
  | 'datetime'
  | 'signature';

export type RequestStatus = 'pending' | 'resolved' | 'expired' | 'cancelled';

export type ResolutionMethod = 'direct' | 'auto_approved' | 'delegated';

export type SignatureAlgorithm = 'ES256' | 'EdDSA';

// --- Participation Request ---

export interface ParticipationRequest {
  id: string;
  version: string;
  requester: { appId: string };
  validation: { userId: string };
  action: ActionInfo;
  type: RequestType;
  options?: RequestOption[];
  placeholder?: string;
  masked?: boolean;
  keyboard?: string;
  inputValidation?: InputValidation;
  expiry?: string;
  transaction?: TransactionInfo;
  createdAt: string;
}

export interface ActionInfo {
  summary: string;
  description?: string;
  rationale?: string;
  category?: string;
}

export interface RequestOption {
  key: string;
  label: string;
  freeText?: boolean;
  placeholder?: string;
  validation?: InputValidation;
}

export interface InputValidation {
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
}

export interface TransactionInfo {
  id: string;
  label?: string;
}

// --- Send Request Parameters (user-facing) ---

export interface SendRequestParams {
  userId: string;
  type: RequestType;
  action: ActionInfo;
  options?: RequestOption[];
  placeholder?: string;
  masked?: boolean;
  keyboard?: string;
  inputValidation?: InputValidation;
  expiresAt?: Date;
  expiresInMs?: number;
  transaction?: TransactionInfo;
}

// --- Result Types ---

export interface SendResult {
  success: boolean;
  requestId?: string;
  error?: string;
  httpStatus?: number;
}

export interface StatusResult {
  success: boolean;
  status?: RequestStatus;
  attestation?: AttestationEnvelope;
  selectedOption?: string;
  selectedOptions?: string[];
  value?: string;
  error?: string;
  httpStatus?: number;
}

export interface CancelResult {
  success: boolean;
  error?: string;
  httpStatus?: number;
}

export interface VerificationResult {
  valid: boolean;
  error?: string;
}

// --- Attestation ---

export interface AttestationEnvelope {
  innerAttestation: ParticipationAttestation;
  outerSignature: SignatureInfo;
  issuedAt: string;
}

export interface ParticipationAttestation {
  id: string;
  requestId: string;
  version: string;
  decision: DecisionInfo;
  resolution: ResolutionInfo;
  signature: SignatureInfo;
  issuedAt: string;
}

export interface DecisionInfo {
  selectedOption?: string;
  selectedOptions?: string[];
  value?: string;
  timestamp: string;
}

export interface ResolutionInfo {
  method: ResolutionMethod;
  endpoint: { type: string; id: string };
  autoApproveRule?: string;
  delegatedTo?: string;
  delegatedAttestation?: ParticipationAttestation;
}

export interface SignatureInfo {
  algorithm: SignatureAlgorithm;
  value: string;
  keyId: string;
}

// --- Registration ---

export interface RegistrationChallenge {
  challengeId: string;
  requesterAppId: string;
  expiresAt: string;
  createdAt: string;
}

export interface RegistrationCredentials {
  challengeId: string;
  resolverBaseUrl: string;
  userId: string;
  accessToken: string;
  registrationId: string;
  createdAt: string;
}

// --- Service Metadata (Resolver Discovery) ---

export interface ServiceMetadata {
  name: string;
  protocolVersion: { min: string; max: string };
  endpoints: ServiceEndpoints;
}

export interface ServiceEndpoints {
  participate: string;
  participate_status: string;
  keys: string;
  federation?: string;
}

// --- App Metadata ---

export interface AppMetadata {
  appId: string;
  name: string;
  icon?: string;
  version: string;
  endpoints: { registrationCallback: string };
}

// --- JWKS ---

export interface JwkSet {
  keys: Jwk[];
}

export interface Jwk {
  kty: string;
  kid: string;
  crv?: string;
  x?: string;
  y?: string;
  alg?: string;
  use?: string;
}
