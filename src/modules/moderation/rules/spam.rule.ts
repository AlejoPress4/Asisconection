import { Injectable } from '@nestjs/common';
import type {
  ContentRuleEvaluation,
  IContentRule,
} from '../interfaces/i-content-rule.interface';

const REPEATED_CHAR_PATTERN = /(.)\1{6,}/i;
const CONSONANT_SMASH_PATTERN = /[bcdfghjklmnpqrstvwxyz]{9,}/i;

@Injectable()
export class SpamContentRule implements IContentRule {
  readonly name = 'SPAM';

  evaluate(content: string): ContentRuleEvaluation {
    if (REPEATED_CHAR_PATTERN.test(content) || CONSONANT_SMASH_PATTERN.test(content)) {
      return {
        matched: true,
        ruleName: this.name,
        detail: 'Patrón de texto aleatorio o repetición excesiva detectado (spam).',
      };
    }

    const letters = content.replace(/[^a-zA-ZÁÉÍÓÚÑáéíóúñ]/g, '');
    if (letters.length >= 20) {
      const upperCount = letters.replace(/[^A-ZÁÉÍÓÚÑ]/g, '').length;
      if (upperCount / letters.length > 0.85) {
        return {
          matched: true,
          ruleName: this.name,
          detail: 'Uso excesivo de mayúsculas detectado (spam).',
        };
      }
    }

    return { matched: false, ruleName: this.name };
  }
}
