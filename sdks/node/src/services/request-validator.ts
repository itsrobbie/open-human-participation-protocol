import type { SendRequestParams, RequestType } from '../domain/types.js';
import { MAX_LENGTHS, MIN_COUNTS } from '../domain/constants.js';

const TYPES_REQUIRING_OPTIONS: RequestType[] = ['select', 'multiselect'];
const TYPES_FORBIDDING_OPTIONS: RequestType[] = ['text', 'number', 'date', 'datetime', 'signature'];
const ALL_TYPES: RequestType[] = ['select', 'multiselect', 'text', 'number', 'date', 'datetime', 'signature'];

/**
 * Validates a SendRequestParams object against protocol constraints.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateRequest(params: SendRequestParams): string | null {
  // PR-12: userId required
  if (!params.userId || params.userId.trim().length === 0) {
    return 'userId is required';
  }

  // PR-05: type must be valid
  if (!ALL_TYPES.includes(params.type)) {
    return 'Invalid request type';
  }

  // PR-01: summary required, max 200
  if (!params.action.summary || params.action.summary.trim().length === 0) {
    return 'Summary is required and must not exceed 200 characters';
  }
  if (params.action.summary.length > MAX_LENGTHS.summary) {
    return 'Summary is required and must not exceed 200 characters';
  }

  // PR-02: description max 2000
  if (params.action.description && params.action.description.length > MAX_LENGTHS.description) {
    return 'Description must not exceed 2000 characters';
  }

  // PR-03: rationale max 500
  if (params.action.rationale && params.action.rationale.length > MAX_LENGTHS.rationale) {
    return 'Rationale must not exceed 500 characters';
  }

  // PR-04: category max 50
  if (params.action.category && params.action.category.length > MAX_LENGTHS.category) {
    return 'Category must not exceed 50 characters';
  }

  // PR-06: options required for select/multiselect, min 2
  if (TYPES_REQUIRING_OPTIONS.includes(params.type)) {
    if (!params.options || params.options.length < MIN_COUNTS.optionsForSelect) {
      return 'Select/multiselect requires at least 2 options';
    }
  }

  // PR-07: options forbidden for other types
  if (TYPES_FORBIDDING_OPTIONS.includes(params.type)) {
    if (params.options && params.options.length > 0) {
      return `Options are not allowed for ${params.type} requests`;
    }
  }

  // Validate options if present
  if (params.options) {
    const keys = new Set<string>();
    for (const option of params.options) {
      // PR-08: label required, max 100
      if (!option.label || option.label.length > MAX_LENGTHS.optionLabel) {
        return 'Option label is required and must not exceed 100 characters';
      }

      // PR-09: key required, unique
      if (!option.key) {
        return 'Option keys must be unique';
      }
      if (keys.has(option.key)) {
        return 'Option keys must be unique';
      }
      keys.add(option.key);
    }
  }

  // PR-10: transaction label max 100
  if (params.transaction?.label && params.transaction.label.length > MAX_LENGTHS.transactionLabel) {
    return 'Transaction label must not exceed 100 characters';
  }

  // PR-11: expiry must be in the future
  if (params.expiresAt && params.expiresAt.getTime() <= Date.now()) {
    return 'Expiry must be in the future';
  }
  if (params.expiresInMs !== undefined && params.expiresInMs <= 0) {
    return 'Expiry must be in the future';
  }

  // PR-13, PR-14: inputValidation min/max
  if (params.inputValidation) {
    if (params.inputValidation.min !== undefined && !Number.isFinite(params.inputValidation.min)) {
      return 'Minimum must be a finite number';
    }
    if (params.inputValidation.max !== undefined && !Number.isFinite(params.inputValidation.max)) {
      return 'Maximum must be >= minimum';
    }
    if (
      params.inputValidation.min !== undefined &&
      params.inputValidation.max !== undefined &&
      params.inputValidation.max < params.inputValidation.min
    ) {
      return 'Maximum must be >= minimum';
    }

    // PR-15: pattern must be valid regex
    if (params.inputValidation.pattern) {
      try {
        new RegExp(params.inputValidation.pattern);
      } catch {
        return 'Pattern must be a valid regular expression';
      }
    }
  }

  return null;
}
