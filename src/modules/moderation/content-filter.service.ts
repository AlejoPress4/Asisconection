import { Inject, Injectable } from '@nestjs/common';
import { ModerationStatus } from '../../common/enums/moderation-status.enum';
import {
  CONTENT_FILTER_RULES,
  type IContentRule,
} from './interfaces/i-content-rule.interface';

export interface ContentFilterResult {
  readonly status: ModerationStatus;
  readonly rejectionReason: 'AUTO_FILTER' | null;
  readonly triggeredRule: string | null;
  readonly detail: string | null;
}

@Injectable()
export class ContentFilterService {
  constructor(
    @Inject(CONTENT_FILTER_RULES)
    private readonly rules: ReadonlyArray<IContentRule>,
  ) {}

  evaluate(content: string): ContentFilterResult {
    for (const rule of this.rules) {
      const evaluation = rule.evaluate(content);
      if (evaluation.matched) {
        return {
          status: ModerationStatus.REJECTED,
          rejectionReason: 'AUTO_FILTER',
          triggeredRule: evaluation.ruleName,
          detail: evaluation.detail ?? null,
        };
      }
    }

    return {
      status: ModerationStatus.PENDING,
      rejectionReason: null,
      triggeredRule: null,
      detail: null,
    };
  }
}
