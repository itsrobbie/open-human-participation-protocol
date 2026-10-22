# Test conversion map (Phase 0.3 of the validation framework)

Snapshot 2026-10-22. Classifies every existing cross-system / UI test so the
sweep knows what to CONVERT (to page objects / the shared scenario), what to
DELETE as duplicated by a `WholeCaseScenario`, and what to KEEP as-is (lower-layer
tests the pyramid wants where they are). Driven in Phase 4.

Legend: CONVERT = move to page-object/scenario; DELETE = superseded duplicate;
KEEP = correct at its layer, just ensure P1/P2 compliance if it touches UI.

## Playwright E2E (tests/e2e/tests/, 35 specs)

| Spec | Class | Why |
|---|---|---|
| 01-bank-transfer | CONVERT | bank requester UI -> BankPage page object |
| 01a-bank-navigation | CONVERT | nav via page object |
| 02-bank-ohpp | CONVERT | folds toward the Bank WholeCaseScenario |
| 03-portal-auth | CONVERT | PortalAttesterPage / login page object |
| 03a-portal-empty-state | CONVERT | portal page object |
| 04-portal-dashboard | CONVERT | portal page object |
| 05-portal-devices | CONVERT | portal page object |
| 06-portal-history | CONVERT | portal page object + audit view (feeds P5) |
| 07-portal-web-approvals | CONVERT | this IS the PortalAttester behaviour -> fold into attester driver |
| 08-portal-session | CONVERT | portal page object |
| 09-portal-navigation | CONVERT | portal page object |
| 12-portal-register-app | CONVERT | portal page object |
| 13-portal-settings | CONVERT | portal page object |
| 15-full-flow-transfer-with-ohpp | CONVERT->REFERENCE | becomes the canonical Bank WholeCaseScenario (web attester) |
| 16-full-flow-transfer-deny | CONVERT | WholeCaseScenario deny variant |
| 17-unhappy-bank-transfers | CONVERT | BankPage + assertions |
| 18-unhappy-portal-connect-app | CONVERT | portal page object |
| 19-unhappy-portal-devices | CONVERT | portal page object |
| 20-unhappy-portal-auth | CONVERT | portal page object |
| 21-unhappy-portal-pending | CONVERT | portal page object |
| 22-bank-batch-transfers | CONVERT | BankPage; also fixes the stale-client strict-mode issue |
| 22a-bank-protocol-types | CONVERT | BankPage |
| 23-insurance-claims | CONVERT | InsurancePage + WholeCaseScenario (insurance) |
| 24-portal-protocol-lab | CONVERT | portal page object |
| 25-world-persistence | KEEP | infra/persistence check, not a UI-logic flow (verify selectors only) |
| 26-portal-quality | CONVERT | portal a11y/quality via page object |
| 27-portal-mobile | CONVERT | portal page object at 375px |
| 28-cli-attester | KEEP | CLI attester path; it IS the pluggable-attester-via-CLI case |
| 30-pizza-auth-and-orders | CONVERT | PizzaPage |
| 31-pizza-pages | CONVERT | PizzaPage |
| 32-marketplace-auth-and-purchases | CONVERT | MarketplacePage |
| 33-marketplace-pages | CONVERT | MarketplacePage |
| 37-pizza-registration-and-order | CONVERT->maybe DELETE | overlaps the Pizza WholeCaseScenario; delete if fully subsumed (also fix its hard-coded dev ports) |
| 40-portal-telemetry | KEEP | telemetry export check (not a cross-system UI flow) |
| 41-crash-reporting | KEEP | crash sink check |

New whole-case specs to ADD (Phase 3): pizza + marketplace via WholeCaseScenario
(web attester) and the app-attester ceremonies.

## Flutter integration_test/ (9 tests + 2 helpers)

| File | Class | Why |
|---|---|---|
| e2e_app_harness.dart | KEEP (helper) | harness base; extend, do not duplicate |
| e2e_helpers.dart | KEEP (helper) | has fetchParticipationHistoryDetail (P5); extend |
| bank_approval_flow_test | CONVERT->REFERENCE | becomes Bank WholeCaseScenario (app attester) via OhppAttester |
| pizza_approval_flow_test | CONVERT | rewrite onto OhppAttester (the blocked B5, now deterministic) |
| app_test | KEEP | per-screen widget/nav coverage (lower layer) |
| auth_test | KEEP | auth integration (lower layer) |
| crypto_device_test | KEEP (hardened in D2) | Secure Enclave skip(reason) on sim, assert on device |
| crash_report_test | KEEP | crash sink |
| telemetry_export_test | KEEP | OTLP export (note: export-only; matrix marks it as such) |
| smoke_device_test | KEEP | smoke |
| e2e_flows_test | KEEP (hardened in D1) | lifecycle; vacuous returns already -> markTestSkipped. PHASE 4 TODO: 4 `find.byKey(Key('pending-card-0'))` refs (lines ~166/188/207/234) must update to the new `ohpp.pending.card.<requestId>` key (card was re-keyed from index to requestId in 1.4). They are guarded-absence on-sim checks so CI is unaffected, but they go stale until converted. |

New (Phase 3): marketplace_approval_flow_test via OhppAttester.

## Deletion candidates (only after their WholeCaseScenario replacement is green)
- 37-pizza-registration-and-order IF the Pizza WholeCaseScenario fully covers it.
- Any 02/07/15/16 content that becomes pure duplication once the scenario +
  PortalAttester exist (keep the scenario, delete the bespoke remainder).

Rule: a spec is DELETED only after its replacement is committed and green, so
coverage never dips. No spec left expressing a flow the fixture also expresses.
