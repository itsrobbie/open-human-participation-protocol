import { randomUUID } from 'node:crypto';
import type { CredentialStore } from '../domain/interfaces.js';
import type { OhppClientOptions } from '../domain/config.js';
import type {
  SendRequestParams,
  SendResult,
  StatusResult,
  CancelResult,
  VerificationResult,
  ParticipationRequest,
  AttestationEnvelope,
} from '../domain/types.js';
import {
  PROTOCOL_VERSION,
  DEFAULT_METADATA_CACHE_TTL_MS,
  DEFAULT_TIMEOUT_MS,
} from '../domain/constants.js';
import { HttpClient, extractError } from '../infrastructure/http-client.js';
import { MetadataDiscovery } from '../infrastructure/metadata-discovery.js';
import { AttestationVerifier } from './attestation-verifier.js';
import { validateRequest } from './request-validator.js';

interface ParticipateResponse {
  requestId?: string;
}

interface StatusResponse {
  status?: string;
  attestation?: AttestationEnvelope;
  selectedOption?: string;
  selectedOptions?: string[];
  value?: string;
}

/**
 * Main SDK client for OHPP Requester applications.
 * Configured via constructor options object. Methods accept typed parameter objects.
 */
export class OhppRequesterClient {
  private readonly options: Required<Pick<OhppClientOptions, 'appId' | 'appName' | 'baseUrl' | 'callbackPath' | 'resolverUrl'>> & OhppClientOptions;
  private readonly credentialStore: CredentialStore;
  private readonly httpClient: HttpClient;
  private readonly discovery: MetadataDiscovery;
  private readonly verifier: AttestationVerifier;
  private readonly protocolVersion: string;

  constructor(options: OhppClientOptions) {
    this.validateOptions(options);
    this.options = options;
    this.credentialStore = options.credentialStore;
    this.protocolVersion = options.protocolVersion ?? PROTOCOL_VERSION;

    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const cacheTtlMs = options.metadataCacheTtlMs ?? DEFAULT_METADATA_CACHE_TTL_MS;

    this.httpClient = new HttpClient(timeoutMs);
    this.discovery = new MetadataDiscovery(this.httpClient, cacheTtlMs);
    this.verifier = new AttestationVerifier(this.httpClient, this.discovery);
  }

  /**
   * Sends a participation request to the Resolver.
   */
  async sendRequest(params: SendRequestParams): Promise<SendResult> {
    // Validate params
    const validationError = validateRequest(params);
    if (validationError) {
      return { success: false, error: validationError };
    }

    // Get credentials
    const credentials = await this.credentialStore.get(params.userId, this.options.resolverUrl);
    if (!credentials) {
      return { success: false, error: 'No registration for user' };
    }

    // Discover metadata
    const metadata = await this.discovery.getMetadata(this.options.resolverUrl);
    if (!metadata) {
      return { success: false, error: 'Resolver unreachable' };
    }

    // Build request
    const request = this.buildRequest(params);

    // Send to Resolver
    const body = JSON.stringify({ payload: JSON.stringify(request) });
    const response = await this.httpClient.post(metadata.endpoints.participate, body, {
      Authorization: `Bearer ${credentials.accessToken}`,
    });

    if (!response.ok) {
      const error = extractError(response.body, response.status);
      return { success: false, error, httpStatus: response.status };
    }

    // Parse response
    let result: ParticipateResponse;
    try {
      result = JSON.parse(response.body) as ParticipateResponse;
    } catch {
      return { success: false, error: 'Could not parse participation response' };
    }

    if (!result.requestId) {
      return { success: false, error: 'Response missing requestId' };
    }

    return { success: true, requestId: result.requestId };
  }

  /**
   * Polls the Resolver for the current status of a participation request.
   */
  async getStatus(requestId: string, userId: string): Promise<StatusResult> {
    const credentials = await this.credentialStore.get(userId, this.options.resolverUrl);
    if (!credentials) {
      return { success: false, error: 'No registration for user' };
    }

    const metadata = await this.discovery.getMetadata(this.options.resolverUrl);
    if (!metadata) {
      return { success: false, error: 'Resolver unreachable' };
    }

    const url = metadata.endpoints.participate_status.replace('{requestId}', requestId);
    const response = await this.httpClient.get(url, {
      Authorization: `Bearer ${credentials.accessToken}`,
    });

    if (!response.ok) {
      const error = extractError(response.body, response.status);
      return { success: false, error, httpStatus: response.status };
    }

    let statusResponse: StatusResponse;
    try {
      statusResponse = JSON.parse(response.body) as StatusResponse;
    } catch {
      return { success: false, error: 'Could not parse status response' };
    }

    const status = statusResponse.status as StatusResult['status'];

    // Auto-verify attestation if present
    if (status === 'resolved' && statusResponse.attestation) {
      const verificationResult = await this.verifier.verify(
        statusResponse.attestation,
        this.options.resolverUrl,
      );
      if (!verificationResult.valid) {
        // Return data but include verification error
        return {
          success: true,
          status,
          attestation: statusResponse.attestation,
          selectedOption: statusResponse.selectedOption,
          selectedOptions: statusResponse.selectedOptions,
          value: statusResponse.value,
          error: `Attestation verification failed: ${verificationResult.error}`,
        };
      }
    }

    return {
      success: true,
      status,
      attestation: statusResponse.attestation,
      selectedOption: statusResponse.selectedOption,
      selectedOptions: statusResponse.selectedOptions,
      value: statusResponse.value,
    };
  }

  /**
   * Cancels a pending participation request.
   */
  async cancelRequest(requestId: string, userId: string): Promise<CancelResult> {
    const credentials = await this.credentialStore.get(userId, this.options.resolverUrl);
    if (!credentials) {
      return { success: false, error: 'No registration for user' };
    }

    const metadata = await this.discovery.getMetadata(this.options.resolverUrl);
    if (!metadata) {
      return { success: false, error: 'Resolver unreachable' };
    }

    // Build cancel URL from status URL pattern
    const url = metadata.endpoints.participate_status
      .replace('{requestId}', requestId)
      .replace('/status', '/cancel');

    const response = await this.httpClient.post(url, '', {
      Authorization: `Bearer ${credentials.accessToken}`,
    });

    if (!response.ok) {
      const error = extractError(response.body, response.status);
      return { success: false, error, httpStatus: response.status };
    }

    return { success: true };
  }

  /**
   * Verifies an attestation envelope against the Resolver's JWKS.
   */
  async verifyAttestation(envelope: AttestationEnvelope): Promise<VerificationResult> {
    return this.verifier.verify(envelope, this.options.resolverUrl);
  }

  /** Exposes metadata discovery for advanced use cases. */
  get metadata(): MetadataDiscovery {
    return this.discovery;
  }

  /** Returns the configured options (read-only). */
  get config(): Readonly<OhppClientOptions> {
    return this.options;
  }

  private buildRequest(params: SendRequestParams): ParticipationRequest {
    let expiry: string | undefined;
    if (params.expiresAt) {
      expiry = params.expiresAt.toISOString();
    } else if (params.expiresInMs) {
      expiry = new Date(Date.now() + params.expiresInMs).toISOString();
    }

    return {
      id: randomUUID().replace(/-/g, ''),
      version: this.protocolVersion,
      requester: { appId: this.options.appId },
      validation: { userId: params.userId },
      action: params.action,
      type: params.type,
      options: params.options,
      placeholder: params.placeholder,
      masked: params.masked,
      keyboard: params.keyboard,
      inputValidation: params.inputValidation,
      expiry,
      transaction: params.transaction,
      createdAt: new Date().toISOString(),
    };
  }

  private validateOptions(options: OhppClientOptions): void {
    if (!options.appId || options.appId.trim().length === 0) {
      throw new Error('appId is required');
    }
    if (!options.appName || options.appName.trim().length === 0) {
      throw new Error('appName is required');
    }
    if (!options.baseUrl || !this.isValidUrl(options.baseUrl)) {
      throw new Error('baseUrl must be a valid URL');
    }
    if (!options.callbackPath || !options.callbackPath.startsWith('/')) {
      throw new Error('callbackPath must start with /');
    }
    if (!options.resolverUrl || !this.isValidUrl(options.resolverUrl)) {
      throw new Error('resolverUrl must be a valid URL');
    }
    if (!options.credentialStore) {
      throw new Error('credentialStore is required');
    }
    if (options.timeoutMs !== undefined && (options.timeoutMs <= 0 || options.timeoutMs > 120_000)) {
      throw new Error('Timeout must be between 1 and 120000ms');
    }
    if (options.metadataCacheTtlMs !== undefined && options.metadataCacheTtlMs < 0) {
      throw new Error('Cache TTL must be non-negative');
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}
