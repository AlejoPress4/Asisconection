export interface FaqKnowledgeProjection {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
  readonly category: string;
}

export interface CreateFaqKnowledgeInput {
  readonly question: string;
  readonly answer: string;
  readonly category: string;
}

export interface UpdateFaqKnowledgeInput {
  readonly question?: string;
  readonly answer?: string;
  readonly category?: string;
}

export interface IFaqKnowledgeRepository {
  findPaginated(
    category: string | undefined,
    skip: number,
    take: number,
  ): Promise<{ items: FaqKnowledgeProjection[]; total: number }>;
  create?(input: CreateFaqKnowledgeInput): Promise<FaqKnowledgeProjection>;
  update?(id: string, input: UpdateFaqKnowledgeInput): Promise<FaqKnowledgeProjection | null>;
  deleteById?(id: string): Promise<boolean>;
}

export const FAQ_KNOWLEDGE_REPOSITORY = Symbol('FAQ_KNOWLEDGE_REPOSITORY');
