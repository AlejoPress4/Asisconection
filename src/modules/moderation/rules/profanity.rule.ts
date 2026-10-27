import { Injectable } from '@nestjs/common';
import type {
  ContentRuleEvaluation,
  IContentRule,
} from '../interfaces/i-content-rule.interface';

const DEFAULT_PROFANITY_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(hijueputa|gonorrea|malparid[oa]s?|pirobo|carechimba|marica|mierda|put[oa]s?|imbecil|idiota|estupid[oa]s?)\b/i,
];

@Injectable()
export class ProfanityContentRule implements IContentRule {
  readonly name = 'PROFANITY';

  evaluate(content: string): ContentRuleEvaluation {
    const normalized = content
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    for (const pattern of DEFAULT_PROFANITY_PATTERNS) {
      if (pattern.test(normalized)) {
        return {
          matched: true,
          ruleName: this.name,
          detail: 'Lenguaje ofensivo o groserías detectadas.',
        };
      }
    }

    return { matched: false, ruleName: this.name };
  }
}
