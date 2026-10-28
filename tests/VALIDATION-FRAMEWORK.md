# Validation framework (automated testing contract)

> Canonical, version-controlled copy. A local mirror at
> `.kiro/steering/validation-framework.md` auto-loads this for the AI agent, but
> THIS file is the source of truth that travels with the repo and CI. Edit here.


This repo's whole value is a cross-system handoff (requester -> Resolver ->
attester -> back to requester, with a cryptographic audit trail). Tests that
prove this must be DETERMINISTIC and cheap to add for every new app and request
type. Flaky, bespoke, one-off tests are a defect, not a style choice.

These contracts are BLOCKING for any new or changed UI, test, or requester app.

## The two things that cause flaky UI tests (never do either)

1. AMBIGUITY - locating a control by visible text, widget type, or render order
   (`find.byType(X).first`, `getByText(...)`, nth-child CSS). In a multi-step flow
   a prior step's tree lingers and the wrong element matches.
2. TIMING RACES - a fixed sleep, or acting before an async event (SSE push, modal
   teardown, navigation) has settled.

Everything below removes these structurally.

## Contracts (P1-P8) - all BLOCKING

- **P1 Addressability.** EVERY interactive element on EVERY surface carries a
  stable, scheme-based identifier - never text or render order.
  - Flutter: `Key('ohpp.<area>.<element>.<id>')`
  - Web (React + vanilla): `data-testid="ohpp.<area>.<element>.<id>"`
  - `<area>` = screen/feature (pending, detail, bank, pizza, portal...);
    `<element>` = role (card, option, submit, field, tab...); `<id>` = the stable
    domain id where one exists (requestId, option value), else a stable slug.
  - Pre-existing surfaces that already carry STABLE, scheme-based `data-testid`s
    under a different (bare) naming (e.g. Bank/Insurance `login-submit`,
    `confirm-transfer`) are ACCEPTED as compliant - they satisfy the intent
    (stable, not text/order). Do NOT churn them to the `ohpp.*` prefix. New
    elements and new surfaces use the `ohpp.<area>.<element>.<id>` scheme.
- **P2 Determinism.** Tests NEVER sleep a fixed duration. They wait-until a keyed
  element exists / a condition holds, via the shared helper (`waitForTestId` web,
  `pumpUntilKey` Flutter), with a bounded timeout and a descriptive failure.
- **P3 One driver per role.** The mechanics of a role (answer a participation
  step, log in, initiate an action) live in ONE reusable driver / page object, not
  inline in each test. Tests express intent; drivers do taps/sheets/polls.
- **P4 Pluggable attester, one scenario.** The cross-system flow is the
  `WholeCaseScenario` fixture: logged-in requester -> initiate action -> expect
  participation request(s) -> drive SOME attester -> assert requester done-state ->
  assert audit. The attester (portal web OR Flutter app OR CLI) is swappable
  WITHOUT rewriting the scenario.
- **P5 Audit by construction.** A whole-case test ALWAYS asserts the
  `/api/history/{id}` proof record (attestationPayload, resolvingDeviceId,
  resolvedAt). It cannot pass without proving the trail.
- **P6 Isolation.** Every run starts from known state (tenant `test-stack-*` + DB
  reset). No test assumes data from a prior run.
- **P7 Test seams for the untestable.** Anything the harness genuinely cannot drive
  (native OS pickers, Secure Enclave, real push) gets an explicit build-time test
  seam with a keyed in-app equivalent, OR is `skip(reason)` - NEVER a silent
  vacuous pass. A `return;` in a test body with no prior assertion is banned.
- **P8 The pyramid holds.** unit -> component/widget -> integration (one service +
  real deps) -> whole-case (cross-system). Push each assertion to the lowest layer
  that can hold it. Whole-case tests prove the SEAMS, not logic covered below.

## Rules for new work (enforced)

1. A new interactive element ships with its Key/data-testid in the same change. CI
   lints this; a missing identifier fails the build.
2. A new requester app or request type ships a `WholeCaseScenario` (web attester at
   minimum; app attester if a native app renders the flow) WITH the P5 audit
   assertion.
3. No raw selector / `find.byType().first` / `getByText` as test LOGIC. Use page
   objects (web) or keyed finders + the driver (Flutter). Seeding/assertion via
   backend APIs is allowed in Dart integration tests (as the Bank test does), never
   as Playwright test logic.
4. No silent vacuous pass. If a precondition is unavailable, `skip(reason)` or
   assert - never an unassert-ing early return.
5. One way to express a whole-case flow. Do not add a bespoke parallel version
   beside the fixture; extend the fixture.

## Reference implementation
The Bank whole-case is the canonical example both sides ride:
- Web attester: `tests/e2e/tests/15-full-flow-transfer-with-ohpp.spec.ts`
- App attester: `platform/client-app/integration_test/bank_approval_flow_test.dart`
Shared fixtures live under `tests/e2e/pages/` + `tests/e2e/fixtures/` (web) and
`platform/client-app/integration_test/support/` (Flutter).

## How to add a whole-case test for a new app (the 5-line recipe)
1. Add `data-testid`/`Key` to the app's action-initiation control + result view.
2. Add a page object (web) or reuse `OhppAttester` (app) for the attester steps.
3. Instantiate `WholeCaseScenario` with: requester driver, attester driver, the
   action, the expected done-state.
4. The fixture asserts the audit record automatically (P5).
5. Run serially; it is deterministic by construction.

Full plan + surface inventory:
`aidlc-docs/construction/plans/agentic-validation-framework-plan.md`.
