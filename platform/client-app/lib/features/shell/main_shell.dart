import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:ohpp_client/core/navigation/app_router.dart';
import 'package:ohpp_client/shared/providers/auth_provider.dart';
import 'package:ohpp_client/shared/providers/pending_provider.dart';

/// Main app shell with bottom tab bar and drawer navigation.
class MainShell extends ConsumerStatefulWidget {
  final Widget child;
  final int currentIndex;

  const MainShell({
    super.key,
    required this.child,
    required this.currentIndex,
  });

  @override
  ConsumerState<MainShell> createState() => _MainShellState();
}

class _MainShellState extends ConsumerState<MainShell> {
  @override
  Widget build(BuildContext context) {
    final pendingState = ref.watch(pendingProvider);
    final queueBadge = pendingState.offlineQueueCount;

    return Scaffold(
      body: widget.child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: widget.currentIndex,
        onDestinationSelected: (index) => _onTabTap(context, index),
        destinations: [
          NavigationDestination(
            key: const Key('tab-pending'),
            icon: Badge(
              isLabelVisible: queueBadge > 0,
              label: Text('$queueBadge'),
              child: const Icon(Icons.notifications_outlined),
            ),
            selectedIcon: Badge(
              isLabelVisible: queueBadge > 0,
              label: Text('$queueBadge'),
              child: const Icon(Icons.notifications),
            ),
            label: 'Pending',
          ),
          const NavigationDestination(
            key: Key('tab-history'),
            icon: Icon(Icons.history_outlined),
            selectedIcon: Icon(Icons.history),
            label: 'History',
          ),
          const NavigationDestination(
            key: Key('tab-apps'),
            icon: Icon(Icons.apps_outlined),
            selectedIcon: Icon(Icons.apps),
            label: 'Apps',
          ),
          const NavigationDestination(
            key: Key('tab-profile'),
            icon: Icon(Icons.person_outlined),
            selectedIcon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
      ),
      drawer: Drawer(
        key: const Key('app-drawer'),
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            const DrawerHeader(
              child: Text('OHPP', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
            ),
            ListTile(
              key: const Key('drawer-settings'),
              leading: const Icon(Icons.settings),
              title: const Text('Settings'),
              onTap: () {
                Navigator.pop(context);
                context.push(AppRoutes.settings);
              },
            ),
            ListTile(
              key: const Key('drawer-appearance'),
              leading: const Icon(Icons.palette),
              title: const Text('Appearance'),
              onTap: () {
                Navigator.pop(context);
                context.push(AppRoutes.appearance);
              },
            ),
            ListTile(
              key: const Key('drawer-security'),
              leading: const Icon(Icons.security),
              title: const Text('Security'),
              onTap: () {
                Navigator.pop(context);
                context.push(AppRoutes.security);
              },
            ),
            ListTile(
              key: const Key('drawer-notifications'),
              leading: const Icon(Icons.notifications_outlined),
              title: const Text('Notifications'),
              onTap: () {
                Navigator.pop(context);
                context.push(AppRoutes.notifications);
              },
            ),
            ListTile(
              key: const Key('drawer-rules'),
              leading: const Icon(Icons.rule),
              title: const Text('Participation Rules'),
              onTap: () {
                Navigator.pop(context);
                context.push(AppRoutes.rules);
              },
            ),
            ListTile(
              key: const Key('drawer-developer'),
              leading: const Icon(Icons.bug_report_outlined),
              title: const Text('Developer'),
              onTap: () {
                Navigator.pop(context);
                context.push(AppRoutes.developer);
              },
            ),
            const Divider(),
            ListTile(
              key: const Key('drawer-about'),
              leading: const Icon(Icons.info_outline),
              title: const Text('About'),
              onTap: () => Navigator.pop(context),
            ),
            ListTile(
              key: const Key('drawer-logout'),
              leading: const Icon(Icons.logout),
              title: const Text('Logout'),
              onTap: () {
                Navigator.pop(context);
                ref.read(authProvider.notifier).logout();
                context.go(AppRoutes.login);
              },
            ),
          ],
        ),
      ),
    );
  }

  void _onTabTap(BuildContext context, int index) {
    switch (index) {
      case 0:
        context.go(AppRoutes.pending);
      case 1:
        context.go(AppRoutes.history);
      case 2:
        context.go(AppRoutes.apps);
      case 3:
        context.go(AppRoutes.profile);
    }
  }
}
