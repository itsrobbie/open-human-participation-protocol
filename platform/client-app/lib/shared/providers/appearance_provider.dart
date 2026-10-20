import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Appearance settings (theme, text scale).
class AppearanceData {
  final ThemeMode themeMode;
  final double textScale;

  const AppearanceData({
    this.themeMode = ThemeMode.system,
    this.textScale = 1.0,
  });

  AppearanceData copyWith({ThemeMode? themeMode, double? textScale}) {
    return AppearanceData(
      themeMode: themeMode ?? this.themeMode,
      textScale: textScale ?? this.textScale,
    );
  }
}

class AppearanceNotifier extends StateNotifier<AppearanceData> {
  AppearanceNotifier() : super(const AppearanceData());

  void setThemeMode(ThemeMode mode) {
    state = state.copyWith(themeMode: mode);
  }

  void setTextScale(double scale) {
    state = state.copyWith(textScale: scale);
  }
}

final appearanceProvider =
    StateNotifierProvider<AppearanceNotifier, AppearanceData>((ref) {
  return AppearanceNotifier();
});
