import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Flutter app-attester driver (P2/P3/P4), the Flutter counterpart of the web
/// PortalAttester. Tests express intent (`answerStep(...)`); this driver does
/// the keyed taps, the ensureVisible, the submit, and the deterministic waits.
///
/// Keys it relies on (added/verified in Phase 1.4):
///  - pending card: Key('ohpp.pending.card.<requestId>')
///  - detail sheet submit: Key('detail-submit')
///  - select option: Key('select-chip-<optionKey>')
///  - multiselect option: Key('multiselect-chip-<optionKey>')
///  - text/number field: Key('ohpp.detail.text-field') / Key('ohpp.detail.number-field')
///  - date step: driven via the OutlinedButton inside Key('response-input-date');
///    the native picker is bypassed by the P7 test seam (OHPP_ANTI_AGENT_MODE=test).

/// Deterministic wait: pump until [finder] matches (or [timeout]). No fixed
/// sleep. Throws a descriptive error on timeout so failures name what was
/// expected.
Future<void> pumpUntil(
  WidgetTester tester,
  Finder finder, {
  Duration timeout = const Duration(seconds: 30),
  String? reason,
}) async {
  final end = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(end)) {
    await tester.pump(const Duration(milliseconds: 250));
    if (finder.evaluate().isNotEmpty) return;
  }
  throw TestFailure(
    'pumpUntil timed out after ${timeout.inSeconds}s waiting for $finder'
    '${reason != null ? ' ($reason)' : ''}',
  );
}

/// Convenience: pump until a keyed widget exists.
Future<void> pumpUntilKey(
  WidgetTester tester,
  String key, {
  Duration timeout = const Duration(seconds: 30),
}) =>
    pumpUntil(tester, find.byKey(Key(key)), timeout: timeout, reason: 'key "$key"');

/// One participation step's answer, type-tagged.
sealed class OhppStep {
  const OhppStep();
}

class SelectStep extends OhppStep {
  const SelectStep(this.optionKey);
  final String optionKey;
}

class MultiselectStep extends OhppStep {
  const MultiselectStep(this.optionKeys);
  final List<String> optionKeys;
}

class TextStep extends OhppStep {
  const TextStep(this.value);
  final String value;
}

class NumberStep extends OhppStep {
  const NumberStep(this.value);
  final String value;
}

/// Date step — the native picker is seamed out in test mode, so answering is
/// just: tap the picker button (sets the deterministic default), then submit.
class DateStep extends OhppStep {
  const DateStep();
}

/// The app-attester. Drives the pending list + request detail sheet.
class OhppAttester {
  OhppAttester(this.tester);

  final WidgetTester tester;

  /// Open the detail sheet for the request with [requestId] from the pending
  /// list (keyed card), then answer it according to [step], then submit.
  /// Deterministic throughout; returns after the submit tap.
  Future<void> answerStep(String requestId, OhppStep step) async {
    // Wait for the fresh pending card and open it.
    await pumpUntilKey(tester, 'ohpp.pending.card.$requestId');
    final card = find.byKey(Key('ohpp.pending.card.$requestId'));
    await tester.ensureVisible(card);
    await tester.tap(card);
    await tester.pumpAndSettle();

    // Wait for the detail sheet, then act on the step's keyed control.
    await pumpUntil(tester, find.byKey(const Key('detail-header')),
        reason: 'detail sheet should open');

    switch (step) {
      case SelectStep(:final optionKey):
        final chip = find.byKey(Key('select-chip-$optionKey'));
        await tester.ensureVisible(chip);
        await tester.tap(chip);
      case MultiselectStep(:final optionKeys):
        for (final k in optionKeys) {
          final chip = find.byKey(Key('multiselect-chip-$k'));
          await tester.ensureVisible(chip);
          await tester.tap(chip);
        }
      case TextStep(:final value):
        final field = find.byKey(const Key('ohpp.detail.text-field'));
        await tester.ensureVisible(field);
        await tester.enterText(field, value);
      case NumberStep(:final value):
        final field = find.byKey(const Key('ohpp.detail.number-field'));
        await tester.ensureVisible(field);
        await tester.enterText(field, value);
      case DateStep():
        // The response-input-date wrapper holds an OutlinedButton; tapping it
        // sets the deterministic date via the test seam (no native modal).
        final dateBtn = find.descendant(
          of: find.byKey(const Key('response-input-date')),
          matching: find.byType(OutlinedButton),
        );
        await tester.ensureVisible(dateBtn);
        await tester.tap(dateBtn);
    }
    await tester.pumpAndSettle();

    // Submit.
    final submit = find.byKey(const Key('detail-submit'));
    await tester.ensureVisible(submit);
    await tester.tap(submit);
    await tester.pumpAndSettle();
  }
}
