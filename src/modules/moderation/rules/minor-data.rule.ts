import { Injectable } from '@nestjs/common';
import type {
  ContentRuleEvaluation,
  IContentRule,
} from '../interfaces/i-content-rule.interface';

const MINOR_REFERENCE_PATTERN = /\b(niñ[oa]s?|menor(es)?|infante|beb[eé]|hijo|hija|estudiante)\b/i;
const SENSITIVE_ID_OR_PHONE_PATTERN = /\b(ti\s*[:#-]?\s*\d{6,12}|rc\s*[:#-]?\s*\d{6,12}|documento\s*\d{6,12}|\+?57\s*3\d{9}|\b3\d{9}\b|\b\d{8,11}\b)/i;
const MINOR_FULL_EXPOSURE_PATTERN =
  /\b(niñ[oa]|menor)\s+[a-záéíóúñ]{3,}\s+[a-záéíóúñ]{3,}\s+(de\s+)?\d{1,2}\s*años/i;

@Injectable()
export class MinorDataContentRule implements IContentRule {
  readonly name = 'MINOR_SENSITIVE_DATA';

  evaluate(content: string): ContentRuleEvaluation {
    const hasMinorKeyword = MINOR_REFERENCE_PATTERN.test(content);
    const hasIdOrPhone = SENSITIVE_ID_OR_PHONE_PATTERN.test(content);

    if ((hasMinorKeyword && hasIdOrPhone) || MINOR_FULL_EXPOSURE_PATTERN.test(content)) {
      return {
        matched: true,
        ruleName: this.name,
        detail:
          'Exposición de datos personales o de identificación de menores de edad (Ley 1098 de 2006).',
      };
    }

    return { matched: false, ruleName: this.name };
  }
}
