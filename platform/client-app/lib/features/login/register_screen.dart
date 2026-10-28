import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:ohpp_client/core/theme/app_colors.dart';
import 'package:ohpp_client/features/login/login_screen.dart';

/// Native in-app account creation. Talks ONLY to the Resolver's /api/auth via
/// the loginProvider's register path — the identity provider stays hidden, and
/// swapping it in production changes nothing here. On success the user lands
/// authenticated (the router redirects to Pending).
class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _username = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();

  @override
  void initState() {
    super.initState();
    _username.addListener(_onChanged);
    _email.addListener(_onChanged);
    _password.addListener(_onChanged);
  }

  @override
  void dispose() {
    _username.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  void _onChanged() => setState(() {});

  bool get _isEmpty =>
      _username.text.isEmpty || _email.text.isEmpty || _password.text.isEmpty;

  Future<void> _submit() async {
    final ok = await ref
        .read(loginProvider.notifier)
        .register(_username.text.trim(), _email.text.trim(), _password.text);
    // On success the auth state changes and the router redirects; nothing to do.
    if (!ok && mounted) {
      // Error is surfaced via loginProvider state below.
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(loginProvider);
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          key: const Key('register-back'),
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/login'),
        ),
        title: const Text('Create account'),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  key: const Key('ohpp.register.username'),
                  controller: _username,
                  autocorrect: false,
                  enableSuggestions: false,
                  decoration: const InputDecoration(labelText: 'Username'),
                ),
                const SizedBox(height: 12),
                TextField(
                  key: const Key('ohpp.register.email'),
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  autocorrect: false,
                  enableSuggestions: false,
                  decoration: const InputDecoration(labelText: 'Email'),
                ),
                const SizedBox(height: 12),
                TextField(
                  key: const Key('ohpp.register.password'),
                  controller: _password,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: 'Password'),
                ),
                const SizedBox(height: 16),
                if (state.error != null) ...[
                  Row(
                    key: const Key('ohpp.register.error'),
                    children: [
                      const Icon(Icons.error_outline,
                          color: AppColors.red, size: 18),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(state.error!,
                            style: const TextStyle(
                                color: AppColors.red, fontSize: 14)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                ],
                ElevatedButton(
                  key: const Key('ohpp.register.submit'),
                  onPressed: state.isLoading || _isEmpty ? null : _submit,
                  child: state.isLoading
                      ? const SizedBox(
                          key: Key('ohpp.register.loading'),
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Create account'),
                ),
                const SizedBox(height: 12),
                TextButton(
                  key: const Key('ohpp.register.to-login'),
                  onPressed:
                      state.isLoading ? null : () => context.go('/login'),
                  child: const Text('Already have an account? Sign in'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
