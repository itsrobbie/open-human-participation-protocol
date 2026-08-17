import { describe, it, expect } from 'vitest';
import { ChallengeGenerator } from '../../src/services/challenge-generator.js';

describe('ChallengeGenerator', () => {
  const generator = new ChallengeGenerator({ appId: 'pizza.demo.test' });

  it('createChallenge_defaultValidity_returns5MinExpiry', () => {
    const before = Date.now();
    const challenge = generator.createChallenge();
    const expiresAt = new Date(challenge.expiresAt).getTime();
    const createdAt = new Date(challenge.createdAt).getTime();
    // Default is 5 minutes = 300_000ms
    const diff = expiresAt - createdAt;
    expect(diff).toBeGreaterThanOrEqual(299_000);
    expect(diff).toBeLessThanOrEqual(301_000);
  });

  it('createChallenge_customValidity_returnsCorrectExpiry', () => {
    const challenge = generator.createChallenge(600_000); // 10 minutes
    const expiresAt = new Date(challenge.expiresAt).getTime();
    const createdAt = new Date(challenge.createdAt).getTime();
    const diff = expiresAt - createdAt;
    expect(diff).toBeGreaterThanOrEqual(599_000);
    expect(diff).toBeLessThanOrEqual(601_000);
  });

  it('createChallenge_generatesUniqueIds', () => {
    const c1 = generator.createChallenge();
    const c2 = generator.createChallenge();
    expect(c1.challengeId).not.toBe(c2.challengeId);
  });

  it('createChallenge_setsAppIdFromConfig', () => {
    const challenge = generator.createChallenge();
    expect(challenge.requesterAppId).toBe('pizza.demo.test');
  });

  it('encodeChallenge_producesValidBase64url', () => {
    const challenge = generator.createChallenge();
    const encoded = ChallengeGenerator.encodeChallenge(challenge);
    // Base64url should not contain +, /, or =
    expect(encoded).not.toMatch(/[+/=]/);
    expect(encoded.length).toBeGreaterThan(0);
  });

  it('decodeChallenge_roundTrips_correctly', () => {
    const challenge = generator.createChallenge();
    const encoded = ChallengeGenerator.encodeChallenge(challenge);
    const decoded = ChallengeGenerator.decodeChallenge(encoded);
    expect(decoded).toEqual(challenge);
  });

  it('decodeChallenge_malformedInput_returnsNull', () => {
    const result = ChallengeGenerator.decodeChallenge('not-valid-base64url!!!');
    expect(result).toBeNull();
  });

  it('buildChallengeUri_producesCorrectOhppScheme', () => {
    const challenge = generator.createChallenge();
    const uri = ChallengeGenerator.buildChallengeUri(challenge);
    expect(uri).toMatch(/^ohpp:\/\/register\?challenge=.+$/);
    // Verify the challenge param decodes back
    const param = uri.split('challenge=')[1]!;
    const decoded = ChallengeGenerator.decodeChallenge(param);
    expect(decoded).toEqual(challenge);
  });
});
