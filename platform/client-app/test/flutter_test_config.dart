import 'dart:async';

import 'package:flutter/foundation.dart';
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
// fails. 0.02% (0.0002) is the figure Rows measured for the identical setup
// (M1 Mac devs + x86 Ubuntu GitHub Actions + Docker Linux image): their
// arm64<->amd64 drift never exceeded 0.02%, far below any meaningful visual
// change. See rows.com/blog/post/writing-a-localfilecomparator-with-threshold.
//
// To tune to THIS project's real measured drift, read the "golden passed under
// tolerance" lines this comparator prints on a CI run and set the threshold just
// above the observed maximum.
const double _kGoldenDiffTolerance = 0.0002; // 0.02%

Future<void> testExecutable(FutureOr<void> Function() testMain) async {
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

    // Over tolerance: real visual change. Write the diff artifacts and fail,
    // matching the default comparator's behaviour.
    await generateFailureOutput(result, golden, basedir);
    return false;
  }
}
