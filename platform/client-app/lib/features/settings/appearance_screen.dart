import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:ohpp_client/core/theme/app_colors.dart';
import 'package:ohpp_client/shared/providers/appearance_provider.dart';

/// Appearance settings: theme toggle and text scale slider.
class AppearanceScreen extends ConsumerWidget {
  const AppearanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appearance = ref.watch(appearanceProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Appearance')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          const Text(
            'THEME',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.slate400,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 12),
          _buildThemeSegments(ref, appearance.themeMode),
          const SizedBox(height: 32),
          const Text(
            'TEXT SIZE',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.slate400,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 12),
          _buildTextScaleSlider(ref, appearance.textScale),
          const SizedBox(height: 24),
          _buildTextPreview(appearance.textScale),
        ],
      ),
    );
  }

  Widget _buildThemeSegments(WidgetRef ref, ThemeMode current) {
    return SegmentedButton<ThemeMode>(
      segments: [
        ButtonSegment<ThemeMode>(
          value: ThemeMode.system,
          label: Text(key: const Key('theme-segment-system'), 'System'),
          icon: const Icon(Icons.settings_suggest, size: 18),
        ),
        ButtonSegment<ThemeMode>(
          value: ThemeMode.light,
          label: Text(key: const Key('theme-segment-light'), 'Light'),
          icon: const Icon(Icons.light_mode, size: 18),
        ),
        ButtonSegment<ThemeMode>(
          value: ThemeMode.dark,
          label: Text(key: const Key('theme-segment-dark'), 'Dark'),
          icon: const Icon(Icons.dark_mode, size: 18),
        ),
      ],
      selected: {current},
      onSelectionChanged: (selection) {
        ref.read(appearanceProvider.notifier).setThemeMode(selection.first);
      },
    );
  }

  Widget _buildTextScaleSlider(WidgetRef ref, double scale) {
    return Row(
      children: [
        const Text('A', style: TextStyle(fontSize: 12)),
        Expanded(
          child: Slider(
            key: const Key('text-scale-slider'),
            value: scale,
            min: 0.8,
            max: 1.4,
            divisions: 6,
            label: '${(scale * 100).round()}%',
            onChanged: (val) {
              ref.read(appearanceProvider.notifier).setTextScale(val);
            },
          ),
        ),
        const Text('A', style: TextStyle(fontSize: 20)),
      ],
    );
  }

  Widget _buildTextPreview(double scale) {
    return Container(
      key: const Key('text-scale-preview'),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.slate50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.slate200),
      ),
      child: Text(
        'This is a preview of how text will appear at your chosen size.',
        style: TextStyle(fontSize: 15 * scale),
      ),
    );
  }
}
