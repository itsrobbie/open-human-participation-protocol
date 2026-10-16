import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ohpp_client/core/theme/app_colors.dart';
import 'package:ohpp_client/core/theme/app_theme.dart';

void main() {
  group('Theme golden tests', () {
    testWidgets('theme_sample_card_light', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: Center(
              child: SizedBox(
                width: 350,
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            CircleAvatar(
                              backgroundColor: AppColors.indigo,
                              child: const Text('P', style: TextStyle(color: Colors.white)),
                            ),
                            const SizedBox(width: 12),
                            const Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('pizza.example.com', style: TextStyle(fontWeight: FontWeight.w600)),
                                  Text('Approve order for \$45.00', style: TextStyle(fontSize: 14)),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Chip(
                              label: const Text('Select'),
                              backgroundColor: AppColors.indigo.withValues(alpha: 0.1),
                            ),
                            const Spacer(),
                            Text('2 min ago', style: TextStyle(color: AppColors.slate400, fontSize: 12)),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/theme_sample_card_light.png'),
      );
    });

    testWidgets('theme_sample_card_dark', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.dark(),
          home: Scaffold(
            body: Center(
              child: SizedBox(
                width: 350,
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            CircleAvatar(
                              backgroundColor: AppColors.indigo,
                              child: const Text('P', style: TextStyle(color: Colors.white)),
                            ),
                            const SizedBox(width: 12),
                            const Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('pizza.example.com', style: TextStyle(fontWeight: FontWeight.w600)),
                                  Text('Approve order for \$45.00', style: TextStyle(fontSize: 14)),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Chip(
                              label: const Text('Select'),
                              backgroundColor: AppColors.indigo.withValues(alpha: 0.1),
                            ),
                            const Spacer(),
                            Text('2 min ago', style: TextStyle(color: AppColors.slate400, fontSize: 12)),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/theme_sample_card_dark.png'),
      );
    });

    testWidgets('theme_color_palette_light', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: Padding(
              padding: const EdgeInsets.all(16),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _colorSwatch('Indigo', AppColors.indigo),
                  _colorSwatch('Emerald', AppColors.emerald),
                  _colorSwatch('Slate 900', AppColors.slate900),
                  _colorSwatch('Red', AppColors.red),
                  _colorSwatch('Amber', AppColors.amber),
                  _colorSwatch('Green', AppColors.green),
                ],
              ),
            ),
          ),
        ),
      );

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/theme_color_palette_light.png'),
      );
    });

    testWidgets('theme_color_palette_dark', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.dark(),
          home: Scaffold(
            body: Padding(
              padding: const EdgeInsets.all(16),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _colorSwatch('Indigo', AppColors.indigo),
                  _colorSwatch('Emerald', AppColors.emerald),
                  _colorSwatch('Slate 900', AppColors.slate900),
                  _colorSwatch('Red', AppColors.red),
                  _colorSwatch('Amber', AppColors.amber),
                  _colorSwatch('Green', AppColors.green),
                ],
              ),
            ),
          ),
        ),
      );

      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/theme_color_palette_dark.png'),
      );
    });
  });
}

Widget _colorSwatch(String label, Color color) {
  return Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        width: 60,
        height: 60,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(8),
        ),
      ),
      const SizedBox(height: 4),
      Text(label, style: const TextStyle(fontSize: 10)),
    ],
  );
}
