/**
 * Test stack URLs — these point to the isolated test containers
 * (docker-compose.test.yml, project name: ohpp-test).
 *
 * Different ports from the dev stack so they never conflict.
 */
export const PORTAL_URL = 'http://localhost:3100'
export const RESOLVER_URL = 'http://localhost:5150'
export const BANK_URL = 'http://localhost:5110'
export const INSURANCE_URL = 'http://localhost:5120'
export const KEYCLOAK_URL = 'http://localhost:8180'
