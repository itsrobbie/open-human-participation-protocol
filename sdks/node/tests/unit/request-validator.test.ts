import { describe, it, expect } from 'vitest';
import { validateRequest } from '../../src/services/request-validator.js';
import type { SendRequestParams } from '../../src/domain/types.js';

function validSelect(): SendRequestParams {
  return {
    userId: 'user-1',
    type: 'select',
    action: { summary: 'Confirm order' },
    options: [
      { key: 'yes', label: 'Yes' },
      { key: 'no', label: 'No' },
    ],
  };
}

function validText(): SendRequestParams {
  return {
    userId: 'user-1',
    type: 'text',
    action: { summary: 'Enter instructions' },
  };
}

describe('RequestValidator', () => {
  describe('valid requests', () => {
    it('validate_validSelectRequest_passes', () => {
      expect(validateRequest(validSelect())).toBeNull();
    });

    it('validate_validMultiselectRequest_passes', () => {
      const params = { ...validSelect(), type: 'multiselect' as const };
      expect(validateRequest(params)).toBeNull();
    });

    it('validate_validTextRequest_passes', () => {
      expect(validateRequest(validText())).toBeNull();
    });

    it('validate_validNumberRequest_passes', () => {
      const params: SendRequestParams = {
        userId: 'user-1',
        type: 'number',
        action: { summary: 'Enter amount' },
        inputValidation: { min: 0, max: 100 },
      };
      expect(validateRequest(params)).toBeNull();
    });

    it('validate_validDateRequest_passes', () => {
      const params: SendRequestParams = {
        userId: 'user-1',
        type: 'date',
        action: { summary: 'Pick a date' },
      };
      expect(validateRequest(params)).toBeNull();
    });

    it('validate_validDatetimeRequest_passes', () => {
      const params: SendRequestParams = {
        userId: 'user-1',
        type: 'datetime',
        action: { summary: 'Pick a time' },
      };
      expect(validateRequest(params)).toBeNull();
    });

    it('validate_validSignatureRequest_passes', () => {
      const params: SendRequestParams = {
        userId: 'user-1',
        type: 'signature',
        action: { summary: 'Sign document' },
      };
      expect(validateRequest(params)).toBeNull();
    });
  });

  describe('summary validation', () => {
    it('validate_missingSummary_fails', () => {
      const params = validSelect();
      params.action.summary = '';
      expect(validateRequest(params)).toContain('Summary');
    });

    it('validate_summaryTooLong_fails', () => {
      const params = validSelect();
      params.action.summary = 'x'.repeat(201);
      expect(validateRequest(params)).toContain('200');
    });
  });

  describe('description/rationale/category validation', () => {
    it('validate_descriptionTooLong_fails', () => {
      const params = validSelect();
      params.action.description = 'x'.repeat(2001);
      expect(validateRequest(params)).toContain('2000');
    });

    it('validate_rationaleTooLong_fails', () => {
      const params = validSelect();
      params.action.rationale = 'x'.repeat(501);
      expect(validateRequest(params)).toContain('500');
    });

    it('validate_categoryTooLong_fails', () => {
      const params = validSelect();
      params.action.category = 'x'.repeat(51);
      expect(validateRequest(params)).toContain('50');
    });
  });

  describe('options validation', () => {
    it('validate_selectWithNoOptions_fails', () => {
      const params = validSelect();
      params.options = undefined;
      expect(validateRequest(params)).toContain('at least 2');
    });

    it('validate_selectWithOneOption_fails', () => {
      const params = validSelect();
      params.options = [{ key: 'yes', label: 'Yes' }];
      expect(validateRequest(params)).toContain('at least 2');
    });

    it('validate_textWithOptions_fails', () => {
      const params = validText();
      params.options = [
        { key: 'a', label: 'A' },
        { key: 'b', label: 'B' },
      ];
      expect(validateRequest(params)).toContain('not allowed');
    });

    it('validate_duplicateOptionKeys_fails', () => {
      const params = validSelect();
      params.options = [
        { key: 'same', label: 'First' },
        { key: 'same', label: 'Second' },
      ];
      expect(validateRequest(params)).toContain('unique');
    });

    it('validate_optionLabelTooLong_fails', () => {
      const params = validSelect();
      params.options = [
        { key: 'a', label: 'x'.repeat(101) },
        { key: 'b', label: 'Ok' },
      ];
      expect(validateRequest(params)).toContain('100');
    });
  });

  describe('other field validation', () => {
    it('validate_missingUserId_fails', () => {
      const params = validSelect();
      params.userId = '';
      expect(validateRequest(params)).toContain('userId');
    });

    it('validate_expiryInPast_fails', () => {
      const params = validSelect();
      params.expiresAt = new Date(Date.now() - 60_000);
      expect(validateRequest(params)).toContain('future');
    });

    it('validate_minGreaterThanMax_fails', () => {
      const params = validText();
      params.inputValidation = { min: 100, max: 10 };
      expect(validateRequest(params)).toContain('>=');
    });

    it('validate_invalidPattern_fails', () => {
      const params = validText();
      params.inputValidation = { pattern: '[invalid' };
      expect(validateRequest(params)).toContain('regular expression');
    });
  });
});
