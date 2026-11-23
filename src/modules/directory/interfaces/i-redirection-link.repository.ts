export interface RedirectionLinkProjection {
  readonly id: string;
  readonly projectName: string;
  readonly url: string;
  readonly description: string;
}

export interface CreateRedirectionLinkInput {
  readonly projectName: string;
  readonly url: string;
  readonly description: string;
}

export interface UpdateRedirectionLinkInput {
  readonly projectName?: string;
  readonly url?: string;
  readonly description?: string;
  readonly isActive?: boolean;
}

export interface IRedirectionLinkRepository {
  findActivePaginated(
    skip: number,
    take: number,
  ): Promise<{ items: RedirectionLinkProjection[]; total: number }>;
  create?(input: CreateRedirectionLinkInput): Promise<RedirectionLinkProjection>;
  update?(
    id: string,
    input: UpdateRedirectionLinkInput,
  ): Promise<RedirectionLinkProjection | null>;
  deleteById?(id: string): Promise<boolean>;
}

export const REDIRECTION_LINK_REPOSITORY = Symbol('REDIRECTION_LINK_REPOSITORY');
