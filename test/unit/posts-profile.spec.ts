import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { SessionContext } from '../../src/common/auth/interfaces/session-context.interface';
import { ModerationStatus } from '../../src/common/enums/moderation-status.enum';
import { ReactionType } from '../../src/common/enums/reaction-type.enum';
import { ContentFilterService } from '../../src/modules/moderation/content-filter.service';
import { ExternalLinkContentRule } from '../../src/modules/moderation/rules/external-link.rule';
import { PostsService } from '../../src/modules/social/services/posts.service';
import type { ICategoryRepository } from '../../src/modules/social/interfaces/i-category.repository';
import type { IPostRepository } from '../../src/modules/social/interfaces/i-post.repository';
import type { ICommentRepository } from '../../src/modules/social/interfaces/i-comment.repository';
import type { IReactionRepository } from '../../src/modules/social/interfaces/i-reaction.repository';

describe('PostsService - Profile Posts', () => {
  let service: PostsService;
  let findApprovedPaginatedMock: jest.Mock;
  let findUserAccountIdByActorIdMock: jest.Mock;
  let findAggregatedNotificationsMock: jest.Mock;
  let getLastNotificationsReadAtMock: jest.Mock;
  let updateLastNotificationsReadAtMock: jest.Mock;

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
    findAggregatedNotificationsMock = jest.fn();
    getLastNotificationsReadAtMock = jest.fn();
    updateLastNotificationsReadAtMock = jest.fn();

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
      findAggregatedNotifications: findAggregatedNotificationsMock,
      getLastNotificationsReadAt: getLastNotificationsReadAtMock,
      updateLastNotificationsReadAt: updateLastNotificationsReadAtMock,
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

  describe('listNotifications & markNotificationsRead', () => {
    it('returns empty array if session has no userAccountId', async () => {
      const anonSession: SessionContext = {
        ...sampleSession,
        userAccountId: null,
      };

      const result = await service.listNotifications(anonSession, { page: 1, limit: 10, skip: 0 });
      expect(result.data).toEqual([]);
      expect(result.meta.total_items).toBe(0);
    });

    it('aggregates notifications across interactions and determines is_read via lastReadAt', async () => {
      const now = new Date('2026-11-09T12:00:00Z');
      const older = new Date('2026-11-09T10:00:00Z');
      const newer = new Date('2026-11-09T13:00:00Z');

      getLastNotificationsReadAtMock.mockResolvedValue(now);
      findAggregatedNotificationsMock.mockResolvedValue([
        {
          id: 'notif-1',
          notif_type: 'LIKE_ON_POST',
          title: 'Nueva reacción a tu publicación',
          body: 'Carlos reaccionó a tu publicación.',
          created_at: older,
        },
        {
          id: 'notif-2',
          notif_type: 'NEW_FOLLOWER',
          title: 'Nueva conexión en tu perfil',
          body: 'Lucía comenzó a seguirte.',
          created_at: newer,
        },
      ]);

      const result = await service.listNotifications(sampleSession, { page: 1, limit: 10, skip: 0 });

      expect(findAggregatedNotificationsMock).toHaveBeenCalled();
      expect(result.data).toHaveLength(2);
      // older <= now -> is_read = true
      expect(result.data[0]?.is_read).toBe(true);
      expect(result.data[0]?.type).toBe('LIKE_ON_POST');
      // newer > now -> is_read = false
      expect(result.data[1]?.is_read).toBe(false);
      expect(result.data[1]?.type).toBe('NEW_FOLLOWER');
    });

    it('updates last_notifications_read_at on markNotificationsRead', async () => {
      const result = await service.markNotificationsRead(sampleSession);

      expect(updateLastNotificationsReadAtMock).toHaveBeenCalledWith('user-account-456');
      expect(result.marked_read).toBe(true);
      expect(result.updated_at).toBeDefined();
    });
  });

  describe('CU-02, CU-03 & CU-04: Personalized Following Feed, Lifecycle & Bookmarks', () => {
    it('blocks anonymous sessions from requesting feed=following and allows registered users', async () => {
      const anonSession: SessionContext = {
        ...sampleSession,
        userAccountId: null,
      };

      await expect(
        service.listApproved(
          { page: 1, limit: 10, skip: 0, feed: 'following' },
          undefined,
          anonSession,
        ),
      ).rejects.toThrow(ForbiddenException);

      await service.listApproved(
        { page: 1, limit: 10, skip: 0, feed: 'following', search: '#inclusion' },
        undefined,
        sampleSession,
      );

      expect(findApprovedPaginatedMock).toHaveBeenCalledWith(
        undefined,
        0,
        10,
        undefined,
        {
          search: '#inclusion',
          feed: 'following',
          followerUserAccountId: 'user-account-456',
        },
      );
    });

    it('re-evaluates ContentFilterService and resets post to PENDING (or REJECTED) on updatePost (RN-02)', async () => {
      const findByIdMock = jest.fn().mockResolvedValue({
        id: 'post-1',
        deviceId: 'device-123',
        userAccountId: 'user-account-456',
        categoryId: 'cat-1',
        content: 'Texto original aprobado',
        imageUrl: null,
        status: ModerationStatus.APPROVED,
        rejectionReason: null,
        createdAt: new Date('2026-11-09T10:00:00Z'),
        updatedAt: new Date('2026-11-09T10:00:00Z'),
      });
      const updatePostMock = jest.fn().mockImplementation((_id: string, data: { status: ModerationStatus; rejectionReason: string | null }) =>
        Promise.resolve({
          id: 'post-1',
          status: data.status,
          rejectionReason: data.rejectionReason,
          createdAt: new Date('2026-11-09T10:00:00Z'),
        }),
      );

      const postRepoWithLifecycle: IPostRepository = {
        create: jest.fn(),
        findStatusById: jest.fn().mockResolvedValue(ModerationStatus.APPROVED),
        findApprovedPaginated: findApprovedPaginatedMock,
        findById: findByIdMock,
        updatePost: updatePostMock,
        deleteById: jest.fn().mockResolvedValue(true),
        toggleBookmark: jest.fn().mockResolvedValue(true),
        findViewerReactionsByPostIds: jest
          .fn()
          .mockResolvedValue(new Map([['post-1', [ReactionType.SUPPORT]]])),
        findBookmarkedPostIds: jest.fn().mockResolvedValue(new Set(['post-1'])),
        findApprovedById: jest.fn().mockResolvedValue({
          id: 'post-1',
          categoryId: 'cat-1',
          content: 'Publicación de prueba',
          imageUrl: null,
          mediaUrls: [],
          createdAt: new Date('2026-11-09T10:00:00Z'),
          userAccountId: 'user-account-456',
          username: 'maria.acudiente',
          rol: 'ACUDIENTE',
          nickname: null,
          roleTag: null,
        }),
        countReactionsByPostIds: jest.fn().mockResolvedValue(new Map()),
        findRecentApprovedComments: jest.fn().mockResolvedValue(new Map()),
        countApprovedCommentsByPostIds: jest.fn().mockResolvedValue(new Map()),
      };

      const filterService = new ContentFilterService([new ExternalLinkContentRule()]);
      const lifecycleService = new PostsService(
        { findPaginated: jest.fn(), existsById: jest.fn() },
        postRepoWithLifecycle,
        { create: jest.fn() },
        { toggle: jest.fn() },
        filterService,
      );

      // Edición limpia se mantiene en APPROVED (aprobación directa)
      const approvedRes = await lifecycleService.updatePost(sampleSession, 'post-1', {
        content: 'Texto editado sin enlaces externos',
      });
      expect(approvedRes.status).toBe(ModerationStatus.APPROVED);

      // Edición con enlace externo pasa a REJECTED (AUTO_FILTER)
      const rejectedRes = await lifecycleService.updatePost(sampleSession, 'post-1', {
        content: 'Miren https://spam-externo.com',
      });
      expect(rejectedRes.status).toBe(ModerationStatus.REJECTED);
      expect(rejectedRes.rejection_reason).toBe('AUTO_FILTER');

      // Detalle de post incluye viewer_reactions e is_bookmarked
      const detail = await lifecycleService.getApprovedPostById('post-1', sampleSession);
      expect(detail.viewer_reactions).toEqual([ReactionType.SUPPORT]);
      expect(detail.is_bookmarked).toBe(true);

      // Toggle bookmark
      const bookmarkRes = await lifecycleService.toggleBookmark(sampleSession, 'post-1');
      expect(bookmarkRes).toEqual({ post_id: 'post-1', bookmarked: true });
    });

    it('blocks non-privileged users from creating posts in institutional categories (BK-06)', async () => {
      const institutionalService = new PostsService(
        {
          findPaginated: jest.fn(),
          existsById: jest.fn().mockResolvedValue(true),
          findCategoryById: jest.fn().mockResolvedValue({
            id: 'cat-inst',
            name: 'Noticias de la Fundación',
            mainTopic: 'Institucional',
            description: 'Novedades oficiales',
            coverImageUrl: null,
          }),
        },
        {
          create: jest.fn(),
          findStatusById: jest.fn(),
          findApprovedPaginated: findApprovedPaginatedMock,
          countReactionsByPostIds: jest.fn(),
          findRecentApprovedComments: jest.fn(),
          countApprovedCommentsByPostIds: jest.fn(),
        },
        { create: jest.fn() },
        { toggle: jest.fn() },
      );

      await expect(
        institutionalService.createPost(sampleSession, {
          category_id: 'cat-inst',
          content: 'Intento de aviso oficial por acudiente',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
