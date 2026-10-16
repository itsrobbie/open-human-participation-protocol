import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/lifecycle/app_lifecycle_manager.dart';
import 'core/navigation/app_router.dart';
import 'core/theme/app_theme.dart';
import 'shared/providers/appearance_provider.dart';

class OhppApp extends ConsumerWidget {
  const OhppApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final appearance = ref.watch(appearanceProvider);

    return AppLifecycleManager(
      child: MaterialApp.router(
        title: 'OHPP',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        darkTheme: AppTheme.dark(),
        themeMode: appearance.themeMode,
        routerConfig: router,
      ),
    );
  }
}
