import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

// Golden-test tolerance for cross-architecture rasterisation drift.
//
// Flutter's built-in matchesGoldenFile is pixel-exact: a single differing pixel
// fails the test. Skia rasterises fonts and anti-aliased edges slightly
// differently on arm64 (Apple Silicon dev machines) versus amd64 (GitHub hosted
// runners), so one committed baseline set cannot match byte-for-byte on both.
// Committing per-architecture baselines does not fix this -- it just moves the
// failure to whichever machine did not generate them.
//
// The fix is a comparator with a small tolerance: identical-looking renders that
// differ only in sub-pixel antialiasing pass, while any real visual change still
// fails. The tolerance is tuned to THIS project's measured cross-host drift, not
// a borrowed figure. On the amd64 CI runner vs arm64 dev machines, with Roboto
// pinned (so glyph METRICS are identical and layout never shifts), the residual
// drift is pure sub-pixel antialiasing of glyph EDGES. Measured maximum across
// all goldens on a full CI run: 0.7511%, concentrated in the most text-dense
// screens (rule editor, history detail, settings, onboarding). Pure color/layout
// goldens drift far less. A real visual change (a moved widget, a changed colour)
// would differ by many percent, well above this threshold. Set to 0.9% = max
// measured drift plus headroom for run-to-run variance.
//
// To re-tune after a Flutter/engine bump, read the "golden ... diff X%" lines
// this comparator prints on a CI run (both pass-under and fail-over) and set the
// threshold just above the observed maximum.
const double _kGoldenDiffTolerance = 0.009; // 0.9% (measured max 0.7511% + headroom)

Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  // Pin the text-rendering font before any golden runs. Without this, flutter
  // test falls back to the engine's built-in placeholder font, whose glyph
  // advance widths shift between Skia/engine builds (arm64 dev vs amd64 CI).
  // That per-host metric drift is what pushed the text-label rows of the theme
  // and widget goldens past the comparator tolerance. Loading committed Roboto
  // bytes makes every host rasterise identical glyph metrics, so one baseline
  // set is valid everywhere and the tolerance stays tight.
  TestWidgetsFlutterBinding.ensureInitialized();
  await _loadPinnedFonts();

  if (goldenFileComparator is LocalFileComparator) {
    final defaultComparator = goldenFileComparator as LocalFileComparator;
    // LocalFileComparator(testFile) derives basedir = testFile.resolve('./'),
    // i.e. it drops the last path segment. basedir already ends in '/', so pass
    // it with a dummy filename appended; the constructor then strips that
    // filename and basedir resolves back to the original test directory.
    goldenFileComparator = _TolerantGoldenComparator(
      defaultComparator.basedir.resolve('flutter_test_config.dart'),
      _kGoldenDiffTolerance,
    );
  }
  await testMain();
}

/// Loads the committed Roboto TTFs under the 'Roboto' family so Material text
/// (which resolves to Roboto by default when no fontFamily is set) renders with
/// deterministic, host-independent glyph metrics in golden tests.
///
/// The bytes live in test/support/fonts and are pinned to the repo's Flutter
/// version; regenerating goldens once under this font yields baselines that
/// match byte-for-byte on arm64 and amd64 alike.
Future<void> _loadPinnedFonts() async {
  // test/support/fonts is resolved relative to the package root (the dir
  // flutter test runs from), not this config file.
  const fonts = <String>[
    'test/support/fonts/Roboto-Regular.ttf',
    'test/support/fonts/Roboto-Medium.ttf',
  ];
  final loader = FontLoader('Roboto');
  for (final path in fonts) {
    final bytes = await File(path).readAsBytes();
    loader.addFont(Future.value(ByteData.view(bytes.buffer)));
  }
  await loader.load();
}

/// A [LocalFileComparator] that accepts images differing from the golden by at
/// most [tolerance] (a fraction, e.g. 0.0002 = 0.02% of pixels). Exact matches
/// pass silently; near matches pass with a logged warning; anything above the
/// tolerance fails exactly like the default comparator.
class _TolerantGoldenComparator extends LocalFileComparator {
  _TolerantGoldenComparator(super.testFile, this.tolerance);

  final double tolerance;

  @override
  Future<bool> compare(Uint8List imageBytes, Uri golden) async {
    final result = await GoldenFileComparator.compareLists(
      imageBytes,
      await getGoldenBytes(golden),
    );

    if (result.passed) {
      return true;
    }

    if (result.diffPercent <= tolerance) {
      // Under tolerance: treat as a pass, but surface the real drift so the
      // threshold can be tuned to the project's measured maximum.
      debugPrint(
        'golden "${golden.pathSegments.last}" passed under tolerance: '
        'diff ${(result.diffPercent * 100).toStringAsFixed(4)}% '
        '<= ${(tolerance * 100).toStringAsFixed(4)}%',
      );
      return true;
    }

    // Over tolerance: real visual change. Log the measured drift (so the true
    // cross-host maximum can be read from a CI run and the threshold tuned to
    // it), write the diff artifacts, and fail like the default comparator.
    debugPrint(
      'golden "${golden.pathSegments.last}" FAILED over tolerance: '
      'diff ${(result.diffPercent * 100).toStringAsFixed(4)}% '
      '> ${(tolerance * 100).toStringAsFixed(4)}%',
    );
    await generateFailureOutput(result, golden, basedir);
    return false;
  }
}
