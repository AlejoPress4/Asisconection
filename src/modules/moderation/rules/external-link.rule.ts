import { Injectable } from '@nestjs/common';
import type {
  ContentRuleEvaluation,
  IContentRule,
} from '../interfaces/i-content-rule.interface';

const EXTERNAL_URL_PATTERN = /\b(https?:\/\/\S+|www\.\S+|[a-z0-9-]+\.(com|net|org|co|io|me|gg)\/\S*)/i;

@Injectable()
export class ExternalLinkContentRule implements IContentRule {
  readonly name = 'EXTERNAL_LINK';

  evaluate(content: string): ContentRuleEvaluation {
    if (EXTERNAL_URL_PATTERN.test(content)) {
      return {
        matched: true,
        ruleName: this.name,
        detail: 'No se permiten enlaces externos dentro del texto de publicaciones o comentarios.',
      };
    }

    return { matched: false, ruleName: this.name };
  }
}
