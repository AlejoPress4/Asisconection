import { Inject, Injectable } from '@nestjs/common';
import { ASSISTANT_DISCLAIMER } from '../assistant.constants';
import type {
  AssistantFaqQuery,
  AssistantFaqResult,
  IAssistantEngineProvider,
} from '../interfaces/i-assistant-engine.provider';
import {
  FAQ_KNOWLEDGE_REPOSITORY,
  type IFaqKnowledgeRepository,
} from '../interfaces/i-faq-knowledge.repository';

@Injectable()
export class FaqRuleEngineProvider implements IAssistantEngineProvider {
  constructor(
    @Inject(FAQ_KNOWLEDGE_REPOSITORY)
    private readonly faqKnowledgeRepository: IFaqKnowledgeRepository,
  ) {}

  async resolveFaqs(query: AssistantFaqQuery): Promise<AssistantFaqResult> {
    const skip = (query.page - 1) * query.limit;
    const { items, total } = await this.faqKnowledgeRepository.findPaginated(
      query.category,
      skip,
      query.limit,
    );

    return {
      disclaimer: ASSISTANT_DISCLAIMER,
      items,
      totalItems: total,
    };
  }
}
