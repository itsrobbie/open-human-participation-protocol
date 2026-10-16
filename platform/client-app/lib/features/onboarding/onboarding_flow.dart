import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:ohpp_client/core/theme/app_colors.dart';
import 'package:ohpp_client/shared/providers/telemetry_provider.dart';

/// Onboarding flow shown on first launch.
/// 4 screens: Welcome, How it works, Security, Get started (with telemetry toggle).
class OnboardingFlow extends ConsumerStatefulWidget {
  final VoidCallback onComplete;

  const OnboardingFlow({super.key, required this.onComplete});

  @override
  ConsumerState<OnboardingFlow> createState() => _OnboardingFlowState();
}

class _OnboardingFlowState extends ConsumerState<OnboardingFlow> {
  final _controller = PageController();
  int _currentPage = 0;
  bool _telemetryEnabled = true;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: PageView(
                key: const Key('onboarding-pageview'),
                controller: _controller,
                onPageChanged: (i) => setState(() => _currentPage = i),
                children: [
                  _WelcomePage(key: const Key('onboarding-welcome')),
                  _HowItWorksPage(key: const Key('onboarding-how-it-works')),
                  _SecurityPage(key: const Key('onboarding-security')),
                  _GetStartedPage(
                    key: const Key('onboarding-get-started'),
                    telemetryEnabled: _telemetryEnabled,
                    onTelemetryChanged: (v) => setState(() => _telemetryEnabled = v),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(24),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  if (_currentPage > 0)
                    TextButton(
                      key: const Key('onboarding-back'),
                      onPressed: _back,
                      child: const Text('Back'),
                    )
                  else
                    const SizedBox(width: 80),
                  // Page dots
                  Row(
                    children: List.generate(4, (i) => Container(
                      width: 8,
                      height: 8,
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: i == _currentPage ? AppColors.indigo : AppColors.slate300,
                      ),
                    )),
                  ),
                  _currentPage < 3
                      ? TextButton(
                          key: const Key('onboarding-next'),
                          onPressed: _next,
                          child: const Text('Next'),
                        )
                      : ElevatedButton(
                          key: const Key('onboarding-login'),
                          onPressed: _complete,
                          child: const Text('Log In'),
                        ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _next() {
    _controller.nextPage(duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
  }

  void _back() {
    _controller.previousPage(duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
  }

  void _complete() {
    if (_telemetryEnabled) {
      ref.read(telemetryConsentProvider.notifier).optIn();
    }
    widget.onComplete();
  }
}

class _WelcomePage extends StatelessWidget {
  const _WelcomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.shield_outlined, size: 80, color: AppColors.indigo),
          SizedBox(height: 32),
          Text('Your decisions,\ncryptographically yours.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 16),
          Text('Apps ask for your confirmation before doing something important. This app handles those requests.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 16, color: AppColors.slate500),
          ),
        ],
      ),
    );
  }
}

class _HowItWorksPage extends StatelessWidget {
  const _HowItWorksPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Text('How it works', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
          const SizedBox(height: 32),
          _step(Icons.send, 'App asks', 'An app requests your participation'),
          const SizedBox(height: 16),
          _step(Icons.touch_app, 'You decide', 'You review and respond on your device'),
          const SizedBox(height: 16),
          _step(Icons.verified, 'Proof created', 'A signed attestation proves your decision'),
        ],
      ),
    );
  }

  Widget _step(IconData icon, String title, String subtitle) {
    return Row(
      children: [
        CircleAvatar(backgroundColor: AppColors.indigo.withValues(alpha: 0.1), child: Icon(icon, color: AppColors.indigo)),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
              Text(subtitle, style: const TextStyle(color: AppColors.slate500, fontSize: 14)),
            ],
          ),
        ),
      ],
    );
  }
}

class _SecurityPage extends StatelessWidget {
  const _SecurityPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.lock_outlined, size: 80, color: AppColors.emerald),
          SizedBox(height: 32),
          Text('Your key, your device', textAlign: TextAlign.center, style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
          SizedBox(height: 16),
          Text('Your responses are signed with a key that only your device holds. Even your service provider cannot fake your decisions.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 16, color: AppColors.slate500),
          ),
        ],
      ),
    );
  }
}

class _GetStartedPage extends StatelessWidget {
  final bool telemetryEnabled;
  final ValueChanged<bool> onTelemetryChanged;

  const _GetStartedPage({super.key, required this.telemetryEnabled, required this.onTelemetryChanged});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.rocket_launch, size: 80, color: AppColors.indigo),
          const SizedBox(height: 32),
          const Text('Ready to start', textAlign: TextAlign.center, style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          const Text('Connect to your Participation Service to begin.', textAlign: TextAlign.center, style: TextStyle(fontSize: 16, color: AppColors.slate500)),
          const SizedBox(height: 32),
          SwitchListTile(
            key: const Key('onboarding-telemetry-toggle'),
            value: telemetryEnabled,
            onChanged: onTelemetryChanged,
            title: const Text('Help improve OHPP'),
            subtitle: const Text('Share anonymous usage data to fix bugs and prove adoption for protocol funding.'),
          ),
        ],
      ),
    );
  }
}
