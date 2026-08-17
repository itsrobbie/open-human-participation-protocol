import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';

export interface AuthConfig {
  authority: string; // Keycloak realm URL (internal)
  audience: string; // Expected audience (client ID)
  publicAuthority: string; // Public-facing authority URL
}

/**
 * Express middleware that validates JWTs from Keycloak.
 * Extracts ohpp_user_id claim and attaches to request.
 */
export function authMiddleware(config: AuthConfig) {
  const jwksClient = jwksRsa({
    jwksUri: `${config.authority}/protocol/openid-connect/certs`,
    cache: true,
    cacheMaxEntries: 5,
    cacheMaxAge: 600_000, // 10 minutes
  });

  function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
    if (!header.kid) {
      callback(new Error('No kid in JWT header'));
      return;
    }
    jwksClient.getSigningKey(header.kid, (err, key) => {
      if (err) {
        callback(err);
        return;
      }
      const signingKey = key?.getPublicKey();
      callback(null, signingKey);
    });
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid authorization header' });
      return;
    }

    const token = authHeader.slice(7);

    jwt.verify(
      token,
      getKey,
      {
        algorithms: ['RS256'],
        audience: config.audience,
        issuer: [config.authority, config.publicAuthority],
      },
      (err, decoded) => {
        if (err) {
          res.status(401).json({ error: 'Invalid token' });
          return;
        }

        const payload = decoded as Record<string, unknown>;
        const ohppUserId = payload.ohpp_user_id as string | undefined;

        if (!ohppUserId) {
          res.status(401).json({ error: 'Missing ohpp_user_id claim' });
          return;
        }

        // Attach user info to request for downstream handlers
        (req as AuthenticatedRequest).userId = ohppUserId;
        (req as AuthenticatedRequest).tokenPayload = payload;
        next();
      },
    );
  };
}

export interface AuthenticatedRequest extends Request {
  userId: string;
  tokenPayload: Record<string, unknown>;
}
