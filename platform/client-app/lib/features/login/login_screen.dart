import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:ohpp_client/core/theme/app_colors.dart';

/// Login callback interface (injected for testability).
typedef LoginCallback = Future<bool> Function(String username, String password);

/// State for the login form.
class LoginState {
  final bool isLoading;
  final String? error;

  const LoginState({this.isLoading = false, this.error});
}

class LoginNotifier extends StateNotifier<LoginState> {
  final LoginCallback _onLogin;

  LoginNotifier({required LoginCallback onLogin})
      : _onLogin = onLogin,
        super(const LoginState());

  Future<bool> login(String username, String password) async {
    state = const LoginState(isLoading: true);
    try {
      final success = await _onLogin(username, password);
      if (success) {
        state = const LoginState();
        return true;
      } else {
        state = const LoginState(error: 'Invalid username or password');
        return false;
      }
    } catch (e) {
      state = LoginState(error: e.toString());
      return false;
    }
  }
}

final loginProvider = StateNotifierProvider<LoginNotifier, LoginState>((ref) {
  throw UnimplementedError('Must be overridden');
});

/// Native login form that authenticates with Keycloak.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void initState() {
    super.initState();
    _usernameController.addListener(_onTextChanged);
    _passwordController.addListener(_onTextChanged);
  }

  void _onTextChanged() => setState(() {});

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(loginProvider);

    return Scaffold(
      backgroundColor: AppColors.slate900,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Logo placeholder
                      const Icon(Icons.shield, size: 48, color: AppColors.indigo),
                      const SizedBox(height: 16),
                      const Text(
                        'OHPP',
                        style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Sign in to your Participation Service',
                        style: TextStyle(color: AppColors.slate500),
                      ),
                      const SizedBox(height: 32),
                      TextFormField(
                        key: const Key('login-username'),
                        controller: _usernameController,
                        decoration: const InputDecoration(
                          labelText: 'Username',
                          prefixIcon: Icon(Icons.person_outline),
                        ),
                        validator: (v) => v == null || v.isEmpty ? 'Username is required' : null,
                        textInputAction: TextInputAction.next,
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        key: const Key('login-password'),
                        controller: _passwordController,
                        decoration: const InputDecoration(
                          labelText: 'Password',
                          prefixIcon: Icon(Icons.lock_outline),
                        ),
                        obscureText: true,
                        validator: (v) => v == null || v.isEmpty ? 'Password is required' : null,
                        textInputAction: TextInputAction.done,
                        onFieldSubmitted: (_) => _submit(),
                      ),
                      const SizedBox(height: 24),
                      if (state.error != null) ...[
                        Container(
                          key: const Key('login-error'),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.red.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.error_outline, color: AppColors.red, size: 20),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  state.error!,
                                  style: const TextStyle(color: AppColors.red, fontSize: 14),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          key: const Key('login-submit'),
                          onPressed: state.isLoading || _isEmpty ? null : _submit,
                          child: state.isLoading
                              ? const SizedBox(
                                  key: Key('login-loading'),
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                )
                              : const Text('Sign In'),
                        ),
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
  }

  bool get _isEmpty =>
      _usernameController.text.isEmpty || _passwordController.text.isEmpty;

  void _submit() {
    if (_formKey.currentState!.validate()) {
      ref.read(loginProvider.notifier).login(
        _usernameController.text,
        _passwordController.text,
      );
    }
  }
}
