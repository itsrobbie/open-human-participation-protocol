import type { IOhppPizzaFlowStore } from '../domain/interfaces.js';
import type { OhppPizzaFlowController } from './ohpp-pizza-flow-controller.js';

export interface FlowSequencerOptions {
  /** How often to reconcile active flows, in milliseconds. */
  intervalMs: number;
}

/**
 * Background sequencer that keeps multi-step OHPP Pizza flows moving without the
 * user parked on the ordering screen.
 *
 * WHY THIS EXISTS: the OHPP protocol has no concept of multi-step / sequential
 * requests and no resolver->requester push for resolution. Each participation
 * request is independent; the requester learns a request resolved by POLLING
 * `participate_status`. The pizza app's 7-step flow is therefore application-
 * level orchestration: after step N resolves, the app must itself send step
 * N+1. Previously that only happened while the frontend was polling on the
 * OHPP Pizza page, so answering a step on the phone and leaving the page froze
 * the flow. This sequencer runs that poll-and-advance on the server on a timer,
 * so a flow progresses device-to-device regardless of any open web page.
 *
 * It relies on advanceFlow being idempotent: on a still-pending step it is a
 * no-op; on a resolved step it advances (and sends the next request); on a
 * terminal step it abandons the flow. Ticks never overlap (a slow reconcile is
 * not re-entered), and one failing flow never blocks the others.
 *
 * NOTE: This is the app-side ("Option A") mechanism. A real-time
 * resolver->requester resolution webhook is proposed as a protocol addition
 * (see docs/04-specification) which would let the app react instantly instead
 * of polling on an interval; this sequencer remains valuable as a backstop
 * even if that push is added, since webhooks can be missed.
 */
export class FlowSequencer {
  private readonly intervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false; // guards against overlapping ticks

  constructor(
    private readonly flowStore: IOhppPizzaFlowStore,
    private readonly flowController: OhppPizzaFlowController,
    options: FlowSequencerOptions,
  ) {
    this.intervalMs = options.intervalMs;
  }

  /** Start the periodic reconcile loop. Idempotent. */
  start(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => {
      // Fire-and-forget; reconcileOnce guards against overlap and never throws.
      void this.reconcileOnce();
    }, this.intervalMs);
    // Don't keep the process alive solely for this timer.
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  /** Stop the loop. */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Advance every in_progress flow once. Safe to call directly (used by the
   * timer and by tests). Skips if a previous reconcile is still running, and
   * isolates per-flow failures so one bad flow can't block the rest.
   */
  async reconcileOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const active = await this.flowStore.getAllActive();
      for (const flow of active) {
        try {
          await this.flowController.advanceFlow(flow.id, flow.userId);
        } catch {
          // Best-effort: a single flow's failure must not stop the others.
        }
      }
    } catch {
      // Listing failed (e.g. transient DB error); next tick retries.
    } finally {
      this.running = false;
    }
  }
}
