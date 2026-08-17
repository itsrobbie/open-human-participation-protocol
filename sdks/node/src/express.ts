import type { Request, Response, NextFunction } from 'express';
import type { OhppClientOptions } from './domain/config.js';
import { CallbackHandler } from './services/callback-handler.js';
import { WELL_KNOWN_APP_METADATA_PATH } from './domain/constants.js';

/**
 * Creates Express middleware that handles the OHPP registration callback.
 * Mounts a POST handler at the configured callbackPath.
 */
export function ohppCallbackMiddleware(options: OhppClientOptions) {
  const handler = new CallbackHandler(options.credentialStore);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only handle requests to our callback path
    if (req.path !== options.callbackPath) {
      next();
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    let body = '';
    if (typeof req.body === 'string') {
      body = req.body;
    } else if (req.body && typeof req.body === 'object') {
      body = JSON.stringify(req.body);
    } else {
      // Read raw body
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      body = Buffer.concat(chunks).toString('utf-8');
    }

    const result = await handler.handleCallback(body);
    if (result) {
      res.status(200).json({ status: 'ok' });
    } else {
      res.status(400).json({ error: 'Invalid callback payload' });
    }
  };
}

/**
 * Creates Express middleware that serves the app-metadata endpoint.
 * Mounts a GET handler at /.well-known/ohpp/app-metadata.
 */
export function ohppAppMetadataMiddleware(options: OhppClientOptions) {
  const metadata = {
    appId: options.appId,
    name: options.appName,
    icon: options.iconUrl ?? null,
    version: options.protocolVersion ?? '1.0',
    endpoints: {
      registrationCallback: options.callbackPath,
    },
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.path !== WELL_KNOWN_APP_METADATA_PATH) {
      next();
      return;
    }

    if (req.method !== 'GET') {
      next();
      return;
    }

    res.status(200).json(metadata);
  };
}
