import { randomUUID } from 'node:crypto';
import type { RegistrationChallenge } from '../domain/types.js';
import type { OhppClientOptions } from '../domain/config.js';
import {
  URI_SCHEME,
  REGISTER_ACTION,
  CHALLENGE_PARAM,
  DEFAULT_CHALLENGE_VALIDITY_MS,
} from '../domain/constants.js';

/**
 * Generates registration challenges for the ohpp:// URI scheme.
 */
export class ChallengeGenerator {
  private readonly appId: string;

  constructor(options: Pick<OhppClientOptions, 'appId'>) {
    this.appId = options.appId;
  }

  /**
   * Creates a registration challenge with a unique ID and expiry.
   */
  createChallenge(validityMs: number = DEFAULT_CHALLENGE_VALIDITY_MS): RegistrationChallenge {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + validityMs);

    return {
      challengeId: randomUUID().replace(/-/g, ''),
      requesterAppId: this.appId,
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
    };
  }

  /**
   * Encodes a challenge as a base64url string.
   */
  static encodeChallenge(challenge: RegistrationChallenge): string {
    const json = JSON.stringify(challenge);
    return base64urlEncode(Buffer.from(json, 'utf-8'));
  }

  /**
   * Decodes a base64url-encoded challenge string.
   * Returns null if malformed.
   */
  static decodeChallenge(encoded: string): RegistrationChallenge | null {
    try {
      const bytes = base64urlDecode(encoded);
      const json = bytes.toString('utf-8');
      return JSON.parse(json) as RegistrationChallenge;
    } catch {
      return null;
    }
  }

  /**
   * Builds the full ohpp:// URI for the given challenge.
   * Format: ohpp://register?challenge={base64url}
   */
  static buildChallengeUri(challenge: RegistrationChallenge): string {
    const encoded = ChallengeGenerator.encodeChallenge(challenge);
    return `${URI_SCHEME}://${REGISTER_ACTION}?${CHALLENGE_PARAM}=${encoded}`;
  }
}

function base64urlEncode(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(encoded: string): Buffer {
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4;
  if (padding === 2) base64 += '==';
  else if (padding === 3) base64 += '=';
  return Buffer.from(base64, 'base64');
}
