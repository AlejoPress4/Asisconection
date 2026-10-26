export interface RedirectionLinkProjection {
  readonly id: string;
  readonly projectName: string;
  readonly url: string;
  readonly description: string;
}

export interface IRedirectionLinkRepository {
  findActivePaginated(
    skip: number,
    take: number,
  ): Promise<{ items: RedirectionLinkProjection[]; total: number }>;
}

export const REDIRECTION_LINK_REPOSITORY = Symbol('REDIRECTION_LINK_REPOSITORY');
