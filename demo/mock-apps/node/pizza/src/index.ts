import express from 'express';
import pg from 'pg';
import { OhppRequesterClient, ChallengeGenerator } from '@ohpp/sdk';
import { ohppCallbackMiddleware, ohppAppMetadataMiddleware } from '@ohpp/sdk/express';
import {
  SystemClock,
  PostgresMenuStore,
  PostgresOrderStore,
  PostgresFlowStore,
  PostgresRegistrationStore,
  bootstrapDatabase,
  authMiddleware,
  type AuthConfig,
} from './infrastructure/index.js';
import { OrderService, StandardOrderService, OhppPizzaFlowController } from './services/index.js';
import { createApiRoutes } from './presentation/index.js';

const PORT = parseInt(process.env.PORT ?? '5030', 10);
const APP_ID = process.env.PIZZA_APP_ID ?? 'pizza.demo.test';
const APP_NAME = 'Slice & Dice Pizza';
const BASE_URL = process.env.PIZZA_BASE_URL ?? `http://localhost:${PORT}`;
const RESOLVER_URL = process.env.PIZZA_RESOLVER_URL ?? 'http://resolver:8080';
const CALLBACK_PATH = '/ohpp/callback';

const authConfig: AuthConfig = {
  authority: process.env.AUTH_KEYCLOAK_AUTHORITY ?? 'http://keycloak:8080/realms/ohpp-pizza',
  audience: process.env.AUTH_KEYCLOAK_AUDIENCE ?? 'ohpp-pizza-app',
  publicAuthority: process.env.AUTH_PUBLIC_AUTHORITY ?? 'http://localhost:8080/realms/ohpp-pizza',
};

const dbConnectionString =
  process.env.WORLD_DATABASE_CONNECTION_STRING ??
  'postgresql://pizza_app:ohpp_pizza_demo_password@postgres:5432/ohpp';

async function main() {
  // Database
  const pool = new pg.Pool({ connectionString: dbConnectionString });

  if (process.env.WORLD_DATABASE_RUN_BOOTSTRAP !== 'false') {
    await bootstrapDatabase(pool);
  }

  // Infrastructure
  const clock = new SystemClock();
  const menuStore = new PostgresMenuStore(pool);
  const orderStore = new PostgresOrderStore(pool);
  const flowStore = new PostgresFlowStore(pool);
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
  const orderService = new OrderService(orderStore, clock);
  const standardOrderService = new StandardOrderService(
    orderService, ohppClient, registrationStore,
  );
  const flowController = new OhppPizzaFlowController(
    flowStore, orderStore, ohppClient, registrationStore, clock,
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
    menuStore,
    orderService,
    standardOrderService,
    flowController,
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
  console.error('Failed to start Pizza app:', err);
  process.exit(1);
});
