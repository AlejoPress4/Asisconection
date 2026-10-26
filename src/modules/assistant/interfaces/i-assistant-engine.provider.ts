export interface AssistantFaqQuery {
  readonly category?: string;
  readonly page: number;
  readonly limit: number;
}

export interface AssistantFaqItem {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
  readonly category: string;
}

export interface AssistantFaqResult {
  readonly disclaimer: string;
  readonly items: ReadonlyArray<AssistantFaqItem>;
  readonly totalItems: number;
}

export interface IAssistantEngineProvider {
  resolveFaqs(query: AssistantFaqQuery): Promise<AssistantFaqResult>;
}

export const ASSISTANT_ENGINE_PROVIDER = Symbol('ASSISTANT_ENGINE_PROVIDER');
