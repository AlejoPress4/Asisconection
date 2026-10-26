export interface FaqKnowledgeProjection {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
  readonly category: string;
}

export interface IFaqKnowledgeRepository {
  findPaginated(
    category: string | undefined,
    skip: number,
    take: number,
  ): Promise<{ items: FaqKnowledgeProjection[]; total: number }>;
}

export const FAQ_KNOWLEDGE_REPOSITORY = Symbol('FAQ_KNOWLEDGE_REPOSITORY');
