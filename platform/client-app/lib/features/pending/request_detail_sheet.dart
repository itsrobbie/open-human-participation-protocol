import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';

import 'package:ohpp_client/core/theme/app_colors.dart';
import 'package:ohpp_client/shared/models/attestation.dart';
import 'package:ohpp_client/shared/models/enums.dart';
import 'package:ohpp_client/shared/models/participation_request.dart';

/// Modal bottom sheet showing full request details and response input.
///
/// Supports all 7 OHPP response types:
/// select, multiselect, text, number, date, datetime, signature.
class RequestDetailSheet extends StatefulWidget {
  final ParticipationRequest request;
  final bool alreadyResolved;
  final void Function(AttestationDecision decision) onSubmit;

  const RequestDetailSheet({
    super.key,
    required this.request,
    this.alreadyResolved = false,
    required this.onSubmit,
  });

  @override
  State<RequestDetailSheet> createState() => _RequestDetailSheetState();
}

class _RequestDetailSheetState extends State<RequestDetailSheet> {
  // Select state
  String? _selectedOption;

  // Multiselect state
  final Set<String> _selectedOptions = {};

  // Text/number state
  final TextEditingController _textController = TextEditingController();

  // Date/datetime state
  DateTime? _selectedDate;
  TimeOfDay? _selectedTime;

  // Signature state
  bool _hasSignature = false;
  final List<Offset?> _signaturePoints = [];

  // Countdown timer for expiry
  Timer? _expiryTimer;
  Duration? _remaining;

  @override
  void initState() {
    super.initState();
    if (widget.request.expiry != null) {
      _startExpiryTimer();
    }
  }

  @override
  void dispose() {
    _textController.dispose();
    _expiryTimer?.cancel();
    super.dispose();
  }

  void _startExpiryTimer() {
    _updateRemaining();
    _expiryTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      _updateRemaining();
    });
  }

  void _updateRemaining() {
    final expiry = widget.request.expiry;
    if (expiry == null) return;
    setState(() {
      // Compare in UTC: expiry is a UTC instant (see ParticipationRequest),
      // so `now` must also be UTC or the countdown skews by the local offset.
      _remaining = expiry.toUtc().difference(DateTime.now().toUtc());
      if (_remaining!.isNegative) {
        _remaining = Duration.zero;
        _expiryTimer?.cancel();
      }
    });
  }

  /// True once the request's expiry has passed (countdown hit zero).
  bool get _isExpired => _remaining == Duration.zero;

  bool get _hasValidInput {
    if (widget.alreadyResolved) return false;
    // Can't answer an expired request; the resolver would reject it anyway.
    if (_isExpired) return false;
    switch (widget.request.type) {
      case RequestType.select:
        return _selectedOption != null;
      case RequestType.multiselect:
        return _selectedOptions.isNotEmpty;
      case RequestType.text:
        return _textController.text.trim().isNotEmpty;
      case RequestType.number:
        return _textController.text.trim().isNotEmpty &&
            double.tryParse(_textController.text.trim()) != null;
      case RequestType.date:
        return _selectedDate != null;
      case RequestType.datetime:
        return _selectedDate != null && _selectedTime != null;
      case RequestType.signature:
        return _hasSignature;
    }
  }

  void _handleSubmit() {
    if (!_hasValidInput) return;

    final decision = _buildDecision();
    widget.onSubmit(decision);
  }

  AttestationDecision _buildDecision() {
    switch (widget.request.type) {
      case RequestType.select:
        return AttestationDecision(selectedOption: _selectedOption);
      case RequestType.multiselect:
        return AttestationDecision(selectedOptions: _selectedOptions.toList());
      case RequestType.text:
        return AttestationDecision(value: _textController.text.trim());
      case RequestType.number:
        return AttestationDecision(value: _textController.text.trim());
      case RequestType.date:
        return AttestationDecision(
            value: _selectedDate!.toIso8601String().split('T').first);
      case RequestType.datetime:
        final dt = DateTime(
          _selectedDate!.year,
          _selectedDate!.month,
          _selectedDate!.day,
          _selectedTime!.hour,
          _selectedTime!.minute,
        );
        return AttestationDecision(value: dt.toUtc().toIso8601String());
      case RequestType.signature:
        return AttestationDecision(signatureData: 'sig-data-placeholder');
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) {
        return SingleChildScrollView(
          controller: scrollController,
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildHeader(),
              const SizedBox(height: 16),
              if (widget.alreadyResolved) _buildResolvedBanner(),
              if (widget.request.expiry != null) _buildExpiryIndicator(),
              if (widget.request.description != null) ...[
                const SizedBox(height: 16),
                _buildDescription(),
              ],
              const SizedBox(height: 24),
              _buildResponseInput(),
              const SizedBox(height: 24),
              _buildSubmitButton(),
            ],
          ),
        );
      },
    );
  }

  Widget _buildHeader() {
    return Column(
      key: const Key('detail-header'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            CircleAvatar(
              backgroundColor: AppColors.indigo.withValues(alpha: 0.1),
              child: Text(
                widget.request.appId.isNotEmpty
                    ? widget.request.appId[0].toUpperCase()
                    : '?',
                style: const TextStyle(
                  color: AppColors.indigo,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.request.appName.isNotEmpty
                        ? widget.request.appName
                        : widget.request.appId,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: AppColors.slate500,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    key: const Key('detail-summary'),
                    widget.request.summary,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildResolvedBanner() {
    return Container(
      key: const Key('detail-resolved-banner'),
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.amber.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.amber.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.info_outline, color: AppColors.amber, size: 20),
          const SizedBox(width: 8),
          const Expanded(
            child: Text(
              'Already resolved',
              style: TextStyle(
                color: AppColors.amber,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildExpiryIndicator() {
    final remaining = _remaining;
    if (remaining == null) return const SizedBox.shrink();

    final isUrgent = remaining.inMinutes < 15;
    final color = remaining.inMinutes < 5 ? AppColors.red : AppColors.amber;

    String timeText;
    if (remaining == Duration.zero) {
      timeText = 'Expired';
    } else if (remaining.inHours > 0) {
      timeText = '${remaining.inHours}h ${remaining.inMinutes % 60}m remaining';
    } else if (remaining.inMinutes > 0) {
      timeText = '${remaining.inMinutes}m ${remaining.inSeconds % 60}s remaining';
    } else {
      timeText = '${remaining.inSeconds}s remaining';
    }

    return Container(
      key: const Key('detail-expiry'),
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: isUrgent
            ? color.withValues(alpha: 0.1)
            : AppColors.slate100,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.timer_outlined,
            size: 16,
            color: isUrgent ? color : AppColors.slate500,
          ),
          const SizedBox(width: 6),
          Text(
            timeText,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: isUrgent ? color : AppColors.slate600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDescription() {
    return MarkdownBody(
      key: const Key('detail-description'),
      data: widget.request.description!,
      styleSheet: MarkdownStyleSheet.fromTheme(Theme.of(context)).copyWith(
        p: Theme.of(context).textTheme.bodyMedium,
      ),
    );
  }

  Widget _buildResponseInput() {
    switch (widget.request.type) {
      case RequestType.select:
        return _buildSelectInput();
      case RequestType.multiselect:
        return _buildMultiselectInput();
      case RequestType.text:
        return _buildTextInput();
      case RequestType.number:
        return _buildNumberInput();
      case RequestType.date:
        return _buildDateInput();
      case RequestType.datetime:
        return _buildDatetimeInput();
      case RequestType.signature:
        return _buildSignatureInput();
    }
  }

  Widget _buildSelectInput() {
    return Column(
      key: const Key('response-input-select'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Choose one option',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: AppColors.slate600,
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: (widget.request.options ?? []).map((option) {
            final selected = _selectedOption == option.key;
            return ChoiceChip(
              key: Key('select-chip-${option.key}'),
              label: Text(option.label),
              selected: selected,
              onSelected: widget.alreadyResolved
                  ? null
                  : (val) {
                      setState(() {
                        _selectedOption = val ? option.key : null;
                      });
                    },
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildMultiselectInput() {
    return Column(
      key: const Key('response-input-multiselect'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Choose one or more options',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: AppColors.slate600,
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: (widget.request.options ?? []).map((option) {
            final selected = _selectedOptions.contains(option.key);
            return FilterChip(
              key: Key('multiselect-chip-${option.key}'),
              label: Text(option.label),
              selected: selected,
              onSelected: widget.alreadyResolved
                  ? null
                  : (val) {
                      setState(() {
                        if (val) {
                          _selectedOptions.add(option.key);
                        } else {
                          _selectedOptions.remove(option.key);
                        }
                      });
                    },
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildTextInput() {
    return Column(
      key: const Key('response-input-text'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Enter your response',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: AppColors.slate600,
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _textController,
          enabled: !widget.alreadyResolved,
          maxLines: 3,
          decoration: const InputDecoration(
            hintText: 'Type your response...',
          ),
          onChanged: (_) => setState(() {}),
        ),
      ],
    );
  }

  Widget _buildNumberInput() {
    return Column(
      key: const Key('response-input-number'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Enter a numeric value',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: AppColors.slate600,
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _textController,
          enabled: !widget.alreadyResolved,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(
            hintText: 'Enter number...',
          ),
          onChanged: (_) => setState(() {}),
        ),
      ],
    );
  }

  Widget _buildDateInput() {
    return Column(
      key: const Key('response-input-date'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Select a date',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: AppColors.slate600,
          ),
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: widget.alreadyResolved ? null : _pickDate,
          icon: const Icon(Icons.calendar_today, size: 18),
          label: Text(
            _selectedDate != null
                ? '${_selectedDate!.day}/${_selectedDate!.month}/${_selectedDate!.year}'
                : 'Select date',
          ),
        ),
      ],
    );
  }

  Widget _buildDatetimeInput() {
    return Column(
      key: const Key('response-input-datetime'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Select date and time',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: AppColors.slate600,
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: widget.alreadyResolved ? null : _pickDate,
                icon: const Icon(Icons.calendar_today, size: 18),
                label: Text(
                  _selectedDate != null
                      ? '${_selectedDate!.day}/${_selectedDate!.month}/${_selectedDate!.year}'
                      : 'Date',
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: widget.alreadyResolved ? null : _pickTime,
                icon: const Icon(Icons.access_time, size: 18),
                label: Text(
                  _selectedTime != null
                      ? '${_selectedTime!.hour.toString().padLeft(2, '0')}:${_selectedTime!.minute.toString().padLeft(2, '0')}'
                      : 'Time',
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildSignatureInput() {
    return Column(
      key: const Key('response-input-signature'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Draw your signature',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: AppColors.slate600,
              ),
            ),
            if (_hasSignature)
              TextButton(
                onPressed: () {
                  setState(() {
                    _signaturePoints.clear();
                    _hasSignature = false;
                  });
                },
                child: const Text('Clear'),
              ),
          ],
        ),
        const SizedBox(height: 12),
        Container(
          height: 150,
          width: double.infinity,
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.slate300),
            borderRadius: BorderRadius.circular(8),
          ),
          child: GestureDetector(
            onPanStart: widget.alreadyResolved
                ? null
                : (details) {
                    setState(() {
                      _signaturePoints.add(details.localPosition);
                      _hasSignature = true;
                    });
                  },
            onPanUpdate: widget.alreadyResolved
                ? null
                : (details) {
                    setState(() {
                      _signaturePoints.add(details.localPosition);
                    });
                  },
            onPanEnd: widget.alreadyResolved
                ? null
                : (_) {
                    setState(() {
                      _signaturePoints.add(null); // Break between strokes
                    });
                  },
            child: CustomPaint(
              size: Size.infinite,
              painter: _SignaturePainter(points: _signaturePoints),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSubmitButton() {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        key: const Key('detail-submit'),
        onPressed: _hasValidInput ? _handleSubmit : null,
        child: const Text('Submit Response'),
      ),
    );
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
    }
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _selectedTime ?? TimeOfDay.now(),
    );
    if (picked != null) {
      setState(() => _selectedTime = picked);
    }
  }
}

/// Custom painter for the signature drawing canvas.
class _SignaturePainter extends CustomPainter {
  final List<Offset?> points;

  _SignaturePainter({required this.points});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.slate900
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 2.0;

    for (int i = 0; i < points.length - 1; i++) {
      if (points[i] != null && points[i + 1] != null) {
        canvas.drawLine(points[i]!, points[i + 1]!, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _SignaturePainter oldDelegate) {
    return oldDelegate.points.length != points.length;
  }
}
