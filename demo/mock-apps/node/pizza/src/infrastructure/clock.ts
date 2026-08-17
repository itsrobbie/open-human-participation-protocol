import type { IClock } from '../domain/interfaces.js';

export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }
  isoNow(): string {
    return new Date().toISOString();
  }
}
