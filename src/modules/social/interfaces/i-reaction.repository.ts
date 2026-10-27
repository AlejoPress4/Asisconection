import type { ReactionType } from '../../../common/enums/reaction-type.enum';

export interface IReactionRepository {
  toggle(
    postId: string,
    deviceId: string,
    userAccountId: string | null,
    type: ReactionType,
  ): Promise<boolean>;
  toggleCommentReaction?(
    commentId: string,
    deviceId: string,
    userAccountId: string | null,
    type: ReactionType,
  ): Promise<boolean>;
}

export const REACTION_REPOSITORY = Symbol('REACTION_REPOSITORY');
