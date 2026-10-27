export interface ContentRuleEvaluation {
  readonly matched: boolean;
  readonly ruleName: string;
  readonly detail?: string;
}

export interface IContentRule {
  readonly name: string;
  evaluate(content: string): ContentRuleEvaluation;
}

export const CONTENT_FILTER_RULES = Symbol('CONTENT_FILTER_RULES');
