import express from 'express';
import pg from 'pg';
import { OhppRequesterClient, ChallengeGenerator } from '@ohpp/sdk';
import { ohppCallbackMiddleware, ohppAppMetadataMiddleware } from '@ohpp/sdk/express';
import {
  SystemClock,
  PostgresProductStore,
  PostgresPurchaseStore,
  PostgresRefundStore,
  PostgresRegistrationStore,
  bootstrapDatabase,
  authMiddleware,
  type AuthConfig,
} from './infrastructure/index.js';
import { PurchaseService, ProductService, RefundService } from './services/index.js';
import { createApiRoutes } from './presentation/index.js';

const PORT = parseInt(process.env.PORT ?? '5040', 10);
const APP_ID = process.env.MARKETPLACE_APP_ID ?? 'marketplace.demo.test';
const APP_NAME = 'NeonMarket';
const BASE_URL = process.env.MARKETPLACE_BASE_URL ?? `http://localhost:${PORT}`;
const RESOLVER_URL = process.env.MARKETPLACE_RESOLVER_URL ?? 'http://resolver:8080';
const CALLBACK_PATH = '/ohpp/callback';

const authConfig: AuthConfig = {
  authority: process.env.AUTH_KEYCLOAK_AUTHORITY ?? 'http://keycloak:8080/realms/ohpp-marketplace',
  audience: process.env.AUTH_KEYCLOAK_AUDIENCE ?? 'ohpp-marketplace-app',
  publicAuthority: process.env.AUTH_PUBLIC_AUTHORITY ?? 'http://localhost:8080/realms/ohpp-marketplace',
};

const dbConnectionString =
  process.env.WORLD_DATABASE_CONNECTION_STRING ??
  'postgresql://marketplace_app:ohpp_marketplace_demo_password@postgres:5432/ohpp';

async function main() {
  // Database
  const pool = new pg.Pool({ connectionString: dbConnectionString });

  if (process.env.WORLD_DATABASE_RUN_BOOTSTRAP !== 'false') {
    await bootstrapDatabase(pool);
  }

  // Infrastructure
  const clock = new SystemClock();
  const productStore = new PostgresProductStore(pool);
  const purchaseStore = new PostgresPurchaseStore(pool);
  const refundStore = new PostgresRefundStore(pool);
  const registrationStore = new PostgresRegistrationStore(pool);

  // OHPP SDK Client
  const ohppClient = new OhppRequesterClient({
    appId: APP_ID,
    appName: APP_NAME,
    baseUrl: BASE_URL,
    callbackPath: CALLBACK_PATH,
    resolverUrl: RESOLVER_URL,
    credentialStore: registrationStore,
  });

  const challengeGenerator = new ChallengeGenerator({ appId: APP_ID });

  // Services
  const productService = new ProductService(productStore);
  const purchaseService = new PurchaseService(
    purchaseStore, productStore, ohppClient, registrationStore, clock,
  );
  const refundService = new RefundService(
    refundStore, purchaseStore, ohppClient, registrationStore, clock,
  );

  // Express app
  const app = express();
  app.use(express.json());

  // Health
  app.get('/health', (_req, res) => {
    res.json({ status: 'healthy', app: APP_NAME });
  });

  // Auth config (for frontend)
  app.get('/.well-known/ohpp/auth-config', (_req, res) => {
    res.json({ authority: authConfig.publicAuthority, clientId: authConfig.audience });
  });

  // OHPP protocol endpoints (no auth required)
  app.use(ohppAppMetadataMiddleware({
    appId: APP_ID,
    appName: APP_NAME,
    baseUrl: BASE_URL,
    callbackPath: CALLBACK_PATH,
    resolverUrl: RESOLVER_URL,
    credentialStore: registrationStore,
  }));
  app.use(ohppCallbackMiddleware({
    appId: APP_ID,
    appName: APP_NAME,
    baseUrl: BASE_URL,
    callbackPath: CALLBACK_PATH,
    resolverUrl: RESOLVER_URL,
    credentialStore: registrationStore,
  }));

  // Protected API routes
  const apiRouter = createApiRoutes({
    productService,
    purchaseService,
    refundService,
    registrationStore,
    challengeGenerator,
  });
  app.use('/api', authMiddleware(authConfig), apiRouter);

  // Static files (React frontend) - served after API routes
  app.use(express.static('public'));
  app.get('*', (_req, res) => {
    res.sendFile('index.html', { root: 'public' });
  });

  app.listen(PORT, () => {
    console.log(`${APP_NAME} running on port ${PORT}`);
    console.log(`  App ID: ${APP_ID}`);
    console.log(`  Resolver: ${RESOLVER_URL}`);
  });
}

main().catch((err) => {
  console.error('Failed to start Marketplace app:', err);
  process.exit(1);
});
