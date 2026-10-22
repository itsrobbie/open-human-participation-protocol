# Addressability audit (Phase 0.2 of the validation framework)

Snapshot 2026-10-22, branch `feat/validation-framework`. This is the finite
retrofit checklist for P1 (every interactive element carries a stable
`data-testid` / `Key`). Phase 1 drives each surface to zero gaps.

Scheme: `ohpp.<area>.<element>.<id>` (web `data-testid`, Flutter `Key`).

## Summary (worst-first)

| Surface | Kind | Interactive files | With testid/Key | Gap size |
|---|---|---|---|---|
| Portal | React | 15 | 2 (Pending, ProtocolLab) | LARGE |
| Bank UI | vanilla TS (single app.ts) | 1 file, ~17 DOM points | 0 | MEDIUM (needs DOM scheme) |
| Insurance UI | vanilla TS (single app.ts) | 1 file | 0 | MEDIUM |
| Pizza client | React | 10 | all 10 have some (1-12 each) | SMALL (gap-fill flow controls) |
| Marketplace client | React | 9 | all 9 have some (1-8 each) | SMALL (gap-fill) |
| Flutter app | Flutter | 19 interactive files | 147 Key() usages | SMALL-MED (verify per-step) |
| CLI attester | Dart CLI | n/a (no UI) | n/a | N/A |

## Portal (platform/portal/src) - LARGE, it is the web attester

Interactive files needing a testid pass (count = interactive elements found):
- [ ] pages/Pending.tsx (10) - HAS some; verify every approve/deny/option/submit keyed
- [ ] pages/History.tsx (8) - no testid
- [ ] pages/ProtocolLab.tsx (6) - HAS some; verify
- [ ] pages/Login.tsx (4) - no testid
- [ ] pages/Devices.tsx (4) - no testid
- [ ] components/ConfirmDialog.tsx (3) - no testid (the attester confirm!)
- [ ] pages/Settings.tsx (2) - no testid
- [ ] pages/RegisterApp.tsx (2) - no testid
- [ ] pages/Dashboard.tsx (2) - no testid
- [ ] pages/Apps.tsx (2) - no testid
- [ ] components/Toast.tsx, ThemeToggle.tsx, ErrorState.tsx, EmptyState.tsx (2 each)
- [ ] router.tsx (8) - nav links

## Bank UI (demo/mock-apps/dotnet/bank/ui/src/app.ts) - MEDIUM

Single vanilla-TS SPA (~17 interactive DOM points: buttons, forms, inputs built
via DOM APIs). Needs a DOM-level testid scheme: set `.dataset.testid` (or
`setAttribute('data-testid', ...)`) on each created interactive element.
- [ ] Enumerate the created interactive elements in app.ts and attach testids.

## Insurance UI (demo/mock-apps/dotnet/insurance-claims/ui/src/app.ts) - MEDIUM

Same shape as Bank. Same DOM-testid approach.
- [ ] Enumerate + attach testids in app.ts.

## Pizza client (demo/mock-apps/node/pizza/client/src) - SMALL

All 10 interactive pages already carry testids. Gap-fill only:
- [ ] Verify the 7-step OhppPizzaPage / OrderDetail flow controls each have a
  per-step `data-testid` (select/multiselect/text/date/number/confirm/submit).
- [ ] LoginPage (1) + MenuPage (4) + OrdersPage (3) - confirm action controls keyed.

## Marketplace client (demo/mock-apps/node/marketplace/client/src) - SMALL

All 9 interactive pages already carry testids. Gap-fill only:
- [ ] Verify ProductCard (1) + PurchaseDetailPage (7) purchase+approve controls keyed.

## Flutter app (platform/client-app/lib) - SMALL-MEDIUM

147 Key() usages across 19 interactive files - already well-keyed. Verify the
specific per-step controls the ceremony drive needs:
- [ ] pending list card -> `Key('ohpp.pending.card.<requestId>')`
- [ ] detail sheet submit -> `Key('ohpp.detail.submit')`
- [ ] each step control: ChoiceChip/FilterChip option, TextField, number, and the
  date step (test seam, Phase 2.3) -> keyed per `ohpp.detail.<type>.<value>`

## Conclusion
Retrofit concentration: Portal (large) + Bank/Insurance vanilla (medium). Pizza,
Marketplace, Flutter are small gap-fills. No surface is un-addressable; Bank +
Insurance just need the DOM-testid approach rather than JSX attributes.
