import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { SessionContext } from '../../src/common/auth/interfaces/session-context.interface';
import { PostsService } from '../../src/modules/social/services/posts.service';
import type { ICategoryRepository } from '../../src/modules/social/interfaces/i-category.repository';
import type { IPostRepository } from '../../src/modules/social/interfaces/i-post.repository';
import type { ICommentRepository } from '../../src/modules/social/interfaces/i-comment.repository';
import type { IReactionRepository } from '../../src/modules/social/interfaces/i-reaction.repository';

describe('PostsService - Profile Posts', () => {
  let service: PostsService;
  let findApprovedPaginatedMock: jest.Mock;
  let findUserAccountIdByActorIdMock: jest.Mock;

  const sampleSession: SessionContext = {
    sessionId: 'device-123',
    userAccountId: 'user-account-456',
    username: 'maria.acudiente',
    rol: 'ACUDIENTE',
    nickname: null,
    roleTag: null,
    consentAcceptedAt: new Date(),
    isAccountActive: true,
  };

  beforeEach(() => {
    findApprovedPaginatedMock = jest.fn().mockResolvedValue({
      items: [
        {
          id: 'post-1',
          categoryId: 'cat-1',
          content: 'Publicación de prueba en mi perfil',
          imageUrl: 'https://cdn.example.com/photo.jpg',
          mediaUrls: ['https://cdn.example.com/photo.jpg'],
          createdAt: new Date('2026-11-09T10:00:00Z'),
          userAccountId: 'user-account-456',
          username: 'maria.acudiente',
          rol: 'ACUDIENTE',
          nickname: null,
          roleTag: null,
        },
      ],
      total: 1,
    });
    findUserAccountIdByActorIdMock = jest.fn();

    const categoryRepo: ICategoryRepository = {
      findPaginated: jest.fn(),
      existsById: jest.fn(),
    };

    const postRepo: IPostRepository = {
      create: jest.fn(),
      findStatusById: jest.fn(),
      findApprovedPaginated: findApprovedPaginatedMock,
      countReactionsByPostIds: jest.fn().mockResolvedValue(new Map()),
      findRecentApprovedComments: jest.fn().mockResolvedValue(new Map()),
      countApprovedCommentsByPostIds: jest.fn().mockResolvedValue(new Map()),
      findUserAccountIdByActorId: findUserAccountIdByActorIdMock,
    };

    const commentRepo: ICommentRepository = {
      create: jest.fn(),
      findApprovedByPostId: jest.fn(),
      findById: jest.fn(),
    };

    const reactionRepo: IReactionRepository = {
      toggle: jest.fn(),
      toggleCommentReaction: jest.fn(),
    };

    service = new PostsService(categoryRepo, postRepo, commentRepo, reactionRepo);
  });

  describe('listMyApprovedPosts', () => {
    it('throws ForbiddenException if session has no userAccountId', async () => {
      const anonSession: SessionContext = {
        ...sampleSession,
        userAccountId: null,
      };

      await expect(
        service.listMyApprovedPosts(anonSession, { page: 1, limit: 10, skip: 0 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns approved posts filtered by session.userAccountId', async () => {
      const result = await service.listMyApprovedPosts(sampleSession, {
        page: 1,
        limit: 10,
        skip: 0,
      });

      expect(findApprovedPaginatedMock).toHaveBeenCalledWith(
        undefined,
        0,
        10,
        'user-account-456',
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe('post-1');
      expect(result.data[0]?.content).toBe('Publicación de prueba en mi perfil');
      expect(result.meta.total_items).toBe(1);
    });
  });

  describe('listActorApprovedPosts', () => {
    it('throws NotFoundException if actor is not found', async () => {
      findUserAccountIdByActorIdMock.mockResolvedValue(null);

      await expect(
        service.listActorApprovedPosts('non-existent-actor', {
          page: 1,
          limit: 10,
          skip: 0,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns approved posts of an actor by resolving actorId to userAccountId', async () => {
      findUserAccountIdByActorIdMock.mockResolvedValue('user-account-456');

      const result = await service.listActorApprovedPosts('actor-uuid-789', {
        page: 1,
        limit: 10,
        skip: 0,
      });

      expect(findUserAccountIdByActorIdMock).toHaveBeenCalledWith('actor-uuid-789');
      expect(findApprovedPaginatedMock).toHaveBeenCalledWith(
        undefined,
        0,
        10,
        'user-account-456',
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.author.display_name).toBe('maria.acudiente');
      expect(result.meta.page).toBe(1);
    });
  });
});
