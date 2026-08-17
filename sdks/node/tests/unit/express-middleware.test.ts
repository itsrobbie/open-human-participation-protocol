import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ohppCallbackMiddleware, ohppAppMetadataMiddleware } from '../../src/express.js';
import { InMemoryCredentialStore } from '../../src/infrastructure/in-memory-credential-store.js';
import type { OhppClientOptions } from '../../src/domain/config.js';
import type { Request, Response, NextFunction } from 'express';

function makeOptions(): OhppClientOptions {
  return {
    appId: 'pizza.demo.test',
    appName: 'Demo Pizza',
    baseUrl: 'http://localhost:5030',
    callbackPath: '/ohpp/callback',
    resolverUrl: 'http://localhost:5050',
    credentialStore: new InMemoryCredentialStore(),
  };
}

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    path: '/ohpp/callback',
    method: 'POST',
    headers: {},
    body: JSON.stringify({
      challengeId: 'abc123',
      resolverBaseUrl: 'http://resolver:8080',
      userId: 'user-1',
      accessToken: 'token',
      registrationId: 'reg-1',
      createdAt: '2026-01-01T00:00:00Z',
    }),
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response & { _status: number; _json: unknown } {
  const res = {
    _status: 200,
    _json: null as unknown,
    status(code: number) { res._status = code; return res; },
    json(data: unknown) { res._json = data; return res; },
  };
  return res as unknown as Response & { _status: number; _json: unknown };
}

function mockNext(): NextFunction {
  return vi.fn();
}

describe('Express Middleware', () => {
  let options: OhppClientOptions;

  beforeEach(() => {
    options = makeOptions();
  });

  describe('callbackMiddleware', () => {
    it('callbackMiddleware_validPost_returns200', async () => {
      const mw = ohppCallbackMiddleware(options);
      const req = mockReq();
      const res = mockRes();
      await mw(req, res as unknown as Response, mockNext());
      expect(res._status).toBe(200);
      expect(res._json).toEqual({ status: 'ok' });
    });

    it('callbackMiddleware_invalidBody_returns400', async () => {
      const mw = ohppCallbackMiddleware(options);
      const req = mockReq({ body: JSON.stringify({ incomplete: true }) });
      const res = mockRes();
      await mw(req, res as unknown as Response, mockNext());
      expect(res._status).toBe(400);
    });

    it('callbackMiddleware_emptyBody_returns400', async () => {
      const mw = ohppCallbackMiddleware(options);
      const req = mockReq({ body: '' });
      const res = mockRes();
      await mw(req, res as unknown as Response, mockNext());
      expect(res._status).toBe(400);
    });

    it('callbackMiddleware_nonPostMethod_returns405', async () => {
      const mw = ohppCallbackMiddleware(options);
      const req = mockReq({ method: 'GET' });
      const res = mockRes();
      await mw(req, res as unknown as Response, mockNext());
      expect(res._status).toBe(405);
    });
  });

  describe('appMetadataMiddleware', () => {
    it('appMetadataMiddleware_get_returnsCorrectShape', async () => {
      const mw = ohppAppMetadataMiddleware(options);
      const req = mockReq({ path: '/.well-known/ohpp/app-metadata', method: 'GET' });
      const res = mockRes();
      mw(req, res as unknown as Response, mockNext());
      expect(res._status).toBe(200);
      expect(res._json).toHaveProperty('appId');
      expect(res._json).toHaveProperty('name');
      expect(res._json).toHaveProperty('endpoints');
    });

    it('appMetadataMiddleware_includesAppIdAndName', async () => {
      const mw = ohppAppMetadataMiddleware(options);
      const req = mockReq({ path: '/.well-known/ohpp/app-metadata', method: 'GET' });
      const res = mockRes();
      mw(req, res as unknown as Response, mockNext());
      const json = res._json as Record<string, unknown>;
      expect(json.appId).toBe('pizza.demo.test');
      expect(json.name).toBe('Demo Pizza');
    });

    it('appMetadataMiddleware_includesCallbackPath', async () => {
      const mw = ohppAppMetadataMiddleware(options);
      const req = mockReq({ path: '/.well-known/ohpp/app-metadata', method: 'GET' });
      const res = mockRes();
      mw(req, res as unknown as Response, mockNext());
      const json = res._json as { endpoints: { registrationCallback: string } };
      expect(json.endpoints.registrationCallback).toBe('/ohpp/callback');
    });
  });
});
