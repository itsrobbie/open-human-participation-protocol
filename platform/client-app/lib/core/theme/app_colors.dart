import 'package:flutter/material.dart';

/// Brand colors matching the Portal (indigo primary, emerald accent, slate dark).
class AppColors {
  AppColors._();

  // Primary - Indigo
  static const Color indigo = Color(0xFF6366F1);
  static const Color indigoLight = Color(0xFF818CF8);
  static const Color indigoDark = Color(0xFF4F46E5);

  // Accent - Emerald
  static const Color emerald = Color(0xFF10B981);
  static const Color emeraldLight = Color(0xFF34D399);
  static const Color emeraldDark = Color(0xFF059669);

  // Neutrals - Slate
  static const Color slate900 = Color(0xFF0F172A);
  static const Color slate800 = Color(0xFF1E293B);
  static const Color slate700 = Color(0xFF334155);
  static const Color slate600 = Color(0xFF475569);
  static const Color slate500 = Color(0xFF64748B);
  static const Color slate400 = Color(0xFF94A3B8);
  static const Color slate300 = Color(0xFFCBD5E1);
  static const Color slate200 = Color(0xFFE2E8F0);
  static const Color slate100 = Color(0xFFF1F5F9);
  static const Color slate50 = Color(0xFFF8FAFC);

  // Semantic
  static const Color red = Color(0xFFEF4444);
  static const Color amber = Color(0xFFF59E0B);
  static const Color green = Color(0xFF22C55E);

  // Status
  static const Color pending = amber;
  static const Color resolved = emerald;
  static const Color expired = slate400;
  static const Color cancelled = red;
}
