import { createVerify } from 'node:crypto';
import type { AttestationEnvelope, Jwk, JwkSet, VerificationResult } from '../domain/types.js';
import type { HttpClient } from '../infrastructure/http-client.js';
import type { MetadataDiscovery } from '../infrastructure/metadata-discovery.js';

/**
 * Verifies attestation envelope signatures using the Resolver's JWKS.
 */
export class AttestationVerifier {
  private readonly httpClient: HttpClient;
  private readonly discovery: MetadataDiscovery;

  constructor(httpClient: HttpClient, discovery: MetadataDiscovery) {
    this.httpClient = httpClient;
    this.discovery = discovery;
  }

  async verify(envelope: AttestationEnvelope, resolverBaseUrl: string): Promise<VerificationResult> {
    // 1. Discover metadata to get keys endpoint
    const metadata = await this.discovery.getMetadata(resolverBaseUrl);
    if (!metadata) {
      return { valid: false, error: 'Could not discover Resolver metadata' };
    }

    // 2. Fetch JWKS
    const jwksResponse = await this.httpClient.get(metadata.endpoints.keys);
    if (!jwksResponse.ok) {
      return { valid: false, error: 'Could not fetch Resolver JWKS' };
    }

    let jwks: JwkSet;
    try {
      jwks = JSON.parse(jwksResponse.body) as JwkSet;
    } catch {
      return { valid: false, error: 'Could not parse JWKS response' };
    }

    // 3. Find matching key
    const { keyId, algorithm, value: signatureValue } = envelope.outerSignature;
    const matchingKey = jwks.keys.find((k) => k.kid === keyId);
    if (!matchingKey) {
      return { valid: false, error: `Key '${keyId}' not found in Resolver JWKS` };
    }

    // 4. Check algorithm
    if (algorithm !== 'ES256' && algorithm !== 'EdDSA') {
      return { valid: false, error: `Unsupported signature algorithm '${algorithm}'` };
    }

    // 5. Validate key type matches algorithm
    if (algorithm === 'ES256' && (matchingKey.kty !== 'EC' || matchingKey.crv !== 'P-256')) {
      return { valid: false, error: 'Key type mismatch for algorithm' };
    }
    if (algorithm === 'EdDSA' && (matchingKey.kty !== 'OKP' || matchingKey.crv !== 'Ed25519')) {
      return { valid: false, error: 'Key type mismatch for algorithm' };
    }

    // 6. Decode signature
    let signatureBytes: Buffer;
    try {
      signatureBytes = base64urlDecode(signatureValue);
    } catch {
      return { valid: false, error: 'Signature is not valid base64url' };
    }

    // 7. Canonicalise payload and verify
    const payload = JSON.stringify(envelope.innerAttestation);
    const payloadBytes = Buffer.from(payload, 'utf-8');

    const isValid = this.verifySignature(payloadBytes, signatureBytes, matchingKey, algorithm);
    return isValid
      ? { valid: true }
      : { valid: false, error: 'Signature verification failed' };
  }

  private verifySignature(
    payload: Buffer,
    signature: Buffer,
    key: Jwk,
    algorithm: 'ES256' | 'EdDSA',
  ): boolean {
    try {
      if (algorithm === 'ES256') {
        return this.verifyES256(payload, signature, key);
      }
      if (algorithm === 'EdDSA') {
        return this.verifyEdDSA(payload, signature, key);
      }
      return false;
    } catch {
      return false;
    }
  }

  private verifyES256(payload: Buffer, signature: Buffer, key: Jwk): boolean {
    if (!key.x || !key.y) return false;

    // Use Node's native JWK import
    const crypto = require('node:crypto');
    const keyObject = crypto.createPublicKey({
      key: { kty: 'EC', crv: 'P-256', x: key.x, y: key.y },
      format: 'jwk',
    });

    // ES256 uses IEEE P1363 format (r || s, each 32 bytes)
    // Node's verify with EC keys accepts P1363 when using 'ieee-p1363' DSA encoding
    // But for compatibility, convert to DER
    const derSignature = ieeeP1363ToDer(signature);

    const verifier = createVerify('SHA256');
    verifier.update(payload);
    return verifier.verify(keyObject, derSignature);
  }

  private verifyEdDSA(payload: Buffer, signature: Buffer, key: Jwk): boolean {
    if (!key.x) return false;

    const crypto = require('node:crypto');
    const keyObject = crypto.createPublicKey({
      key: { kty: 'OKP', crv: 'Ed25519', x: key.x },
      format: 'jwk',
    });

    // Ed25519 uses verify directly (no hash algorithm)
    const { verify } = require('node:crypto');
    return verify(null, payload, keyObject, signature);
  }
}

function base64urlDecode(encoded: string): Buffer {
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4;
  if (padding === 2) base64 += '==';
  else if (padding === 3) base64 += '=';
  return Buffer.from(base64, 'base64');
}

/**
 * Converts an IEEE P1363 signature (r || s) to DER format.
 */
function ieeeP1363ToDer(signature: Buffer): Buffer {
  const half = signature.length / 2;
  const r = signature.slice(0, half);
  const s = signature.slice(half);

  const rDer = integerToDer(r);
  const sDer = integerToDer(s);

  const seqLen = rDer.length + sDer.length;
  return Buffer.concat([Buffer.from([0x30, seqLen]), rDer, sDer]);
}

function integerToDer(value: Buffer): Buffer {
  // Remove leading zeros, but ensure high bit isn't set (add 0x00 prefix if needed)
  let start = 0;
  while (start < value.length - 1 && value[start] === 0) start++;
  const trimmed = value.slice(start);

  if (trimmed[0]! & 0x80) {
    // High bit set - need to prefix with 0x00
    return Buffer.concat([Buffer.from([0x02, trimmed.length + 1, 0x00]), trimmed]);
  }
  return Buffer.concat([Buffer.from([0x02, trimmed.length]), trimmed]);
}
