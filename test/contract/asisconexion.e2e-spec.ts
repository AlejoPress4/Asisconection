import { randomUUID } from 'crypto';
import { type INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  DEVICE_SESSION_READER,
  type IDeviceSessionReader,
} from '../../src/common/auth/interfaces/i-device-session-reader';
import type { SessionContext } from '../../src/common/auth/interfaces/session-context.interface';
import { SessionTokenService } from '../../src/common/auth/session-token.service';
import { ModerationStatus } from '../../src/common/enums/moderation-status.enum';
import { ReactionType } from '../../src/common/enums/reaction-type.enum';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { validationExceptionFactory } from '../../src/common/filters/validation-exception.factory';
import { DeviceSessionGuard } from '../../src/common/guards/device-session.guard';
import { OptionalDeviceSessionGuard } from '../../src/common/guards/optional-device-session.guard';
import { RolesGuard } from '../../src/common/guards/roles.guard';
import {
  AdminFaqsController,
  AssistantController,
} from '../../src/modules/assistant/assistant.controller';
import { AssistantService } from '../../src/modules/assistant/assistant.service';
import { ASSISTANT_ENGINE_PROVIDER } from '../../src/modules/assistant/interfaces/i-assistant-engine.provider';
import {
  type CreateFaqKnowledgeInput,
  FAQ_KNOWLEDGE_REPOSITORY,
  type FaqKnowledgeProjection,
  type IFaqKnowledgeRepository,
  type UpdateFaqKnowledgeInput,
} from '../../src/modules/assistant/interfaces/i-faq-knowledge.repository';
import { FaqRuleEngineProvider } from '../../src/modules/assistant/providers/faq-rule-engine.provider';
import { ActorsController } from '../../src/modules/auth-session/actors.controller';
import { ActorsService } from '../../src/modules/auth-session/actors.service';
import { RenderAuthMockAdapter } from '../../src/modules/auth-session/adapters/render-auth.mock-adapter';
import { AuthSessionController } from '../../src/modules/auth-session/auth-session.controller';
import { AuthSessionService } from '../../src/modules/auth-session/auth-session.service';
import type { Actor } from '../../src/modules/auth-session/entities/actor.entity';
import type {
  ActorConnection,
  ActorConnectionStatus,
} from '../../src/modules/auth-session/entities/actor-connection.entity';
import type { DeviceSession } from '../../src/modules/auth-session/entities/device-session.entity';
import type { UserAccount } from '../../src/modules/auth-session/entities/user-account.entity';
import {
  ACTOR_REPOSITORY,
  type IActorRepository,
  type ListConnectionsFilter,
  type SearchActorsFilter,
  type UpdateActorFields,
} from '../../src/modules/auth-session/interfaces/i-actor.repository';
import {
  type CreateAnonymousSessionInput,
  type IUserSyncRepository,
  type SyncUserSessionInput,
  USER_SYNC_REPOSITORY,
} from '../../src/modules/auth-session/interfaces/i-local-user.repository';
import { RENDER_AUTH_ADAPTER } from '../../src/modules/auth-session/interfaces/i-render-auth.adapter';
import {
  AdminDirectoryController,
  DirectoryController,
} from '../../src/modules/directory/directory.controller';
import { DirectoryService } from '../../src/modules/directory/directory.service';
import {
  type CreateRedirectionLinkInput,
  type IRedirectionLinkRepository,
  REDIRECTION_LINK_REPOSITORY,
  type RedirectionLinkProjection,
  type UpdateRedirectionLinkInput,
} from '../../src/modules/directory/interfaces/i-redirection-link.repository';
import { ContentFilterService } from '../../src/modules/moderation/content-filter.service';
import {
  CONTENT_FILTER_RULES,
  type IContentRule,
} from '../../src/modules/moderation/interfaces/i-content-rule.interface';
import {
  type ContentReportRecord,
  type CreateContentReportInput,
  type IModerationRepository,
  MODERATION_REPOSITORY,
} from '../../src/modules/moderation/interfaces/i-moderation.repository';
import { ModerationController } from '../../src/modules/moderation/moderation.controller';
import { ModerationService } from '../../src/modules/moderation/moderation.service';
import { ExternalLinkContentRule } from '../../src/modules/moderation/rules/external-link.rule';
import { MinorDataContentRule } from '../../src/modules/moderation/rules/minor-data.rule';
import { ProfanityContentRule } from '../../src/modules/moderation/rules/profanity.rule';
import { SpamContentRule } from '../../src/modules/moderation/rules/spam.rule';
import { CategoriesController } from '../../src/modules/social/controllers/categories.controller';
import { PostsController } from '../../src/modules/social/controllers/posts.controller';
import type { Comment } from '../../src/modules/social/entities/comment.entity';
import type { Post } from '../../src/modules/social/entities/post.entity';
import {
  CATEGORY_REPOSITORY,
  type ICategoryRepository,
} from '../../src/modules/social/interfaces/i-category.repository';
import {
  COMMENT_REPOSITORY,
  type ICommentRepository,
} from '../../src/modules/social/interfaces/i-comment.repository';
import {
  type FindApprovedPostsOptions,
  type IPostRepository,
  POST_REPOSITORY,
  type UpdatePostData,
} from '../../src/modules/social/interfaces/i-post.repository';
import {
  type IReactionRepository,
  REACTION_REPOSITORY,
} from '../../src/modules/social/interfaces/i-reaction.repository';
import { CategoriesService } from '../../src/modules/social/services/categories.service';
import { PostsService } from '../../src/modules/social/services/posts.service';

class InMemoryPersistenceStore
  implements
    IUserSyncRepository,
    IActorRepository,
    IDeviceSessionReader,
    ICategoryRepository,
    IPostRepository,
    ICommentRepository,
    IReactionRepository,
    IModerationRepository
{
  readonly users = new Map<string, UserAccount>();
  readonly actors = new Map<string, Actor>();
  readonly actorConnections = new Map<string, ActorConnection>();
  readonly sessions = new Map<string, DeviceSession>();
  readonly categories = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Apoyo Pedagógico',
      mainTopic: 'Educación Inclusiva',
      description: 'Experiencias educativas y acompañamiento familiar.',
      coverImageUrl: null,
    },
  ];
  readonly posts = new Map<string, Post>();
  readonly postMedia = new Map<string, string[]>();
  readonly comments = new Map<string, Comment>();
  readonly reactions = new Set<string>();
  readonly commentReactions = new Set<string>();
  readonly bookmarks = new Set<string>();
  readonly contentReports = new Map<string, ContentReportRecord>();

  findByIdentity(
    externalUserId: number | null,
    username: string,
    email: string,
  ): Promise<UserAccount | null> {
    for (const user of this.users.values()) {
      if (
        (externalUserId !== null && user.externalUserId === externalUserId) ||
        user.username.toLowerCase() === username.toLowerCase() ||
        user.email.toLowerCase() === email.toLowerCase()
      ) {
        return Promise.resolve(user);
      }
    }
    return Promise.resolve(null);
  }

  async upsertUserAndSession(
    input: SyncUserSessionInput,
  ): Promise<{ user: UserAccount; actor: Actor; session: DeviceSession }> {
    const existing = await this.findByIdentity(input.externalUserId, input.username, input.email);
    if (existing && !existing.isActive) {
      throw new UnauthorizedException('Cuenta inactiva');
    }

    const now = new Date();
    const externalRoles =
      input.externalRoles && input.externalRoles.length > 0
        ? [...input.externalRoles]
        : [input.rol];

    const user: UserAccount = existing
      ? {
          ...existing,
          externalUserId: input.externalUserId ?? existing.externalUserId,
          username: input.username,
          email: input.email,
          rol: input.rol,
          externalRoles,
          lastSyncedAt: now,
        }
      : {
          id: randomUUID(),
          externalUserId: input.externalUserId,
          username: input.username,
          email: input.email,
          rol: input.rol,
          externalRoles,
          localRole: null,
          isActive: true,
          lastSyncedAt: now,
          createdAt: now,
        };
    this.users.set(user.id, user);

    const actor = await this.ensureForUserAccount(user.id, user.rol);

    const existingAnon = input.existingAnonymousSessionId
      ? this.sessions.get(input.existingAnonymousSessionId)
      : undefined;
    const sessionId =
      existingAnon && existingAnon.userAccountId === null ? existingAnon.id : randomUUID();

    const deviceToken = input.signSessionToken({
      sessionId,
      userAccountId: user.id,
      role: user.rol,
    });

    const session: DeviceSession = {
      id: sessionId,
      userAccountId: user.id,
      deviceToken,
      nickname: user.username,
      roleTag: user.rol,
      consentAcceptedAt: now,
      createdAt: existingAnon?.createdAt ?? now,
    };
    this.sessions.set(session.id, session);
    return { user, actor, session };
  }

  findByUserAccountId(userAccountId: string): Promise<Actor | null> {
    for (const actor of this.actors.values()) {
      if (actor.userAccountId === userAccountId) {
        return Promise.resolve(actor);
      }
    }
    return Promise.resolve(null);
  }

  findById(id: string): Promise<(Actor & Comment & Post) | null> {
    const found = this.actors.get(id) ?? this.comments.get(id) ?? this.posts.get(id) ?? null;
    return Promise.resolve(found as (Actor & Comment & Post) | null);
  }

  async ensureForUserAccount(userAccountId: string, defaultRole: string): Promise<Actor> {
    const existing = await this.findByUserAccountId(userAccountId);
    if (existing) {
      return existing;
    }
    const now = new Date();
    const userAccount = this.users.get(userAccountId)!;
    const created: Actor = {
      id: randomUUID(),
      userAccountId,
      userAccount,
      primaryRole: defaultRole,
      firstNames: null,
      lastNames: null,
      avatarUrl: null,
      shortBio: null,
      createdAt: now,
      updatedAt: now,
    };
    this.actors.set(created.id, created);
    return created;
  }

  async updateByUserAccountId(
    userAccountId: string,
    defaultRole: string,
    fields: UpdateActorFields,
  ): Promise<Actor> {
    const current = await this.ensureForUserAccount(userAccountId, defaultRole);
    const updated: Actor = {
      ...current,
      primaryRole: fields.primaryRole ?? current.primaryRole,
      firstNames: fields.firstNames ?? current.firstNames,
      lastNames: fields.lastNames ?? current.lastNames,
      avatarUrl: fields.avatarUrl ?? current.avatarUrl,
      shortBio: fields.shortBio ?? current.shortBio,
      updatedAt: new Date(),
    };
    this.actors.set(updated.id, updated);
    return updated;
  }

  createConnection(
    requesterActorId: string,
    receiverActorId: string,
    initialStatus: ActorConnectionStatus = 'PENDING',
  ): Promise<ActorConnection> {
    const connection: ActorConnection = {
      id: randomUUID(),
      requesterActorId,
      requesterActor: this.actors.get(requesterActorId)!,
      receiverActorId,
      receiverActor: this.actors.get(receiverActorId)!,
      status: initialStatus,
      requestedAt: new Date(),
      acceptedAt: initialStatus === 'ACCEPTED' ? new Date() : null,
    };
    this.actorConnections.set(connection.id, connection);
    return Promise.resolve(connection);
  }

  findConnectionById(connectionId: string): Promise<ActorConnection | null> {
    return Promise.resolve(this.actorConnections.get(connectionId) ?? null);
  }

  findConnectionBetweenActors(actorAId: string, actorBId: string): Promise<ActorConnection | null> {
    for (const c of this.actorConnections.values()) {
      if (
        (c.requesterActorId === actorAId && c.receiverActorId === actorBId) ||
        (c.requesterActorId === actorBId && c.receiverActorId === actorAId)
      ) {
        return Promise.resolve(c);
      }
    }
    return Promise.resolve(null);
  }

  deleteConnection(connectionId: string): Promise<boolean> {
    return Promise.resolve(this.actorConnections.delete(connectionId));
  }

  searchActors(filter: SearchActorsFilter): Promise<{ items: Actor[]; total: number }> {
    const term = filter.search?.trim().toLowerCase();
    const role = filter.role?.trim().toUpperCase();
    const list = Array.from(this.actors.values()).filter((a) => {
      if (role && a.primaryRole.toUpperCase() !== role) {
        return false;
      }
      if (!term) {
        return true;
      }
      const uname = a.userAccount?.username.toLowerCase() ?? '';
      const fnames = a.firstNames?.toLowerCase() ?? '';
      const lnames = a.lastNames?.toLowerCase() ?? '';
      const bio = a.shortBio?.toLowerCase() ?? '';
      return (
        uname.includes(term) ||
        fnames.includes(term) ||
        lnames.includes(term) ||
        bio.includes(term)
      );
    });
    return Promise.resolve({
      items: list.slice(filter.skip, filter.skip + filter.take),
      total: list.length,
    });
  }

  listFollowers(actorId: string, skip: number, take: number) {
    const list = Array.from(this.actorConnections.values())
      .filter((c) => c.receiverActorId === actorId && c.status === 'ACCEPTED')
      .map((c) => this.actors.get(c.requesterActorId)!)
      .filter(Boolean);
    return Promise.resolve({ items: list.slice(skip, skip + take), total: list.length });
  }

  listFollowing(actorId: string, skip: number, take: number) {
    const list = Array.from(this.actorConnections.values())
      .filter((c) => c.requesterActorId === actorId && c.status === 'ACCEPTED')
      .map((c) => this.actors.get(c.receiverActorId)!)
      .filter(Boolean);
    return Promise.resolve({ items: list.slice(skip, skip + take), total: list.length });
  }

  updateConnectionStatus(
    connectionId: string,
    status: ActorConnectionStatus,
  ): Promise<ActorConnection | null> {
    const existing = this.actorConnections.get(connectionId);
    if (!existing) {
      return Promise.resolve(null);
    }
    const updated: ActorConnection = {
      ...existing,
      status,
      acceptedAt: status === 'ACCEPTED' ? new Date() : existing.acceptedAt,
    };
    this.actorConnections.set(connectionId, updated);
    return Promise.resolve(updated);
  }

  listConnectionsForActor(
    actorId: string,
    skip: number,
    take: number,
    filter?: ListConnectionsFilter,
  ) {
    const direction = filter?.direction ?? 'all';
    const list = Array.from(this.actorConnections.values()).filter((c) => {
      if (filter?.status && c.status !== filter.status) {
        return false;
      }
      if (direction === 'incoming') {
        return c.receiverActorId === actorId;
      }
      if (direction === 'outgoing') {
        return c.requesterActorId === actorId;
      }
      return c.requesterActorId === actorId || c.receiverActorId === actorId;
    });
    return Promise.resolve({ items: list.slice(skip, skip + take), total: list.length });
  }

  createAnonymousSession(input: CreateAnonymousSessionInput): Promise<DeviceSession> {
    const sessionId = randomUUID();
    const roleTag = input.roleTag ?? null;
    const deviceToken = input.signSessionToken({
      sessionId,
      userAccountId: null,
      role: roleTag ?? 'VISITANTE',
    });
    const session: DeviceSession = {
      id: sessionId,
      userAccountId: null,
      deviceToken,
      nickname: input.nickname ?? null,
      roleTag,
      consentAcceptedAt: new Date(),
      createdAt: new Date(),
    };
    this.sessions.set(session.id, session);
    return Promise.resolve(session);
  }

  findSessionContext(sessionId: string, token: string): Promise<SessionContext | null> {
    const session = this.sessions.get(sessionId);
    if (!session || session.deviceToken !== token) {
      return Promise.resolve(null);
    }
    const account = session.userAccountId ? (this.users.get(session.userAccountId) ?? null) : null;
    return Promise.resolve({
      sessionId: session.id,
      userAccountId: session.userAccountId,
      username: account?.username ?? null,
      rol: account?.rol ?? null,
      externalRoles: account?.externalRoles ?? [],
      localRole: account?.localRole ?? null,
      nickname: session.nickname,
      roleTag: session.roleTag,
      consentAcceptedAt: session.consentAcceptedAt,
      isAccountActive: account ? account.isActive : null,
    });
  }

  findPaginated(skip: number, take: number) {
    return Promise.resolve({
      items: this.categories.slice(skip, skip + take),
      total: this.categories.length,
    });
  }

  existsById(id: string): Promise<boolean> {
    return Promise.resolve(this.categories.some((c) => c.id === id));
  }

  findApprovedPaginated(
    categoryId: string | undefined,
    skip: number,
    take: number,
    userAccountId?: string,
    options?: FindApprovedPostsOptions,
  ) {
    let connectedUserAccountIds: Set<string> | undefined;
    if (options?.feed === 'following' && options.followerUserAccountId) {
      connectedUserAccountIds = new Set<string>([options.followerUserAccountId]);
      const myActor = Array.from(this.actors.values()).find(
        (a) => a.userAccountId === options.followerUserAccountId,
      );
      if (myActor) {
        for (const conn of this.actorConnections.values()) {
          if (conn.status === 'ACCEPTED') {
            if (conn.requesterActorId === myActor.id) {
              const rec = this.actors.get(conn.receiverActorId);
              if (rec) connectedUserAccountIds.add(rec.userAccountId);
            } else if (conn.receiverActorId === myActor.id) {
              const req = this.actors.get(conn.requesterActorId);
              if (req) connectedUserAccountIds.add(req.userAccountId);
            }
          }
        }
      }
    }

    const searchLower = options?.search?.trim().toLowerCase();
    const approved = Array.from(this.posts.values()).filter((p) => {
      if (p.status !== ModerationStatus.APPROVED) return false;
      if (categoryId && p.categoryId !== categoryId) return false;
      if (userAccountId && p.userAccountId !== userAccountId) return false;
      if (searchLower && !p.content.toLowerCase().includes(searchLower)) return false;
      if (
        connectedUserAccountIds &&
        (!p.userAccountId || !connectedUserAccountIds.has(p.userAccountId))
      ) {
        return false;
      }
      return true;
    });
    const slice = approved.slice(skip, skip + take).map((p) => {
      const session = this.sessions.get(p.deviceId);
      const user = p.userAccountId ? this.users.get(p.userAccountId) : undefined;
      return {
        id: p.id,
        categoryId: p.categoryId,
        content: p.content,
        imageUrl: p.imageUrl,
        mediaUrls: this.postMedia.get(p.id) ?? [],
        createdAt: p.createdAt,
        userAccountId: p.userAccountId,
        username: user?.username ?? null,
        rol: user?.rol ?? null,
        nickname: session?.nickname ?? null,
        roleTag: session?.roleTag ?? null,
      };
    });
    return Promise.resolve({ items: slice, total: approved.length });
  }

  findApprovedById(postId: string) {
    const p = this.posts.get(postId);
    if (!p || p.status !== ModerationStatus.APPROVED) {
      return Promise.resolve(null);
    }
    const session = this.sessions.get(p.deviceId);
    const user = p.userAccountId ? this.users.get(p.userAccountId) : undefined;
    return Promise.resolve({
      id: p.id,
      categoryId: p.categoryId,
      content: p.content,
      imageUrl: p.imageUrl,
      mediaUrls: this.postMedia.get(p.id) ?? [],
      createdAt: p.createdAt,
      userAccountId: p.userAccountId,
      username: user?.username ?? null,
      rol: user?.rol ?? null,
      nickname: session?.nickname ?? null,
      roleTag: session?.roleTag ?? null,
    });
  }

  updatePost(postId: string, data: UpdatePostData): Promise<Post | null> {
    const existing = this.posts.get(postId);
    if (!existing) {
      return Promise.resolve(null);
    }
    const updated: Post = {
      ...existing,
      content: data.content ?? existing.content,
      imageUrl: data.imageUrl !== undefined ? data.imageUrl : existing.imageUrl,
      status: data.status,
      rejectionReason: data.rejectionReason,
      updatedAt: new Date(),
    };
    this.posts.set(postId, updated);
    if (data.mediaUrls !== undefined) {
      this.postMedia.set(postId, [...data.mediaUrls]);
    }
    return Promise.resolve(updated);
  }

  deleteById(id: string): Promise<boolean> {
    if (this.posts.has(id)) {
      this.posts.delete(id);
      return Promise.resolve(true);
    }
    if (this.comments.has(id)) {
      this.comments.delete(id);
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }

  findMySubmissionsPaginated(
    userAccountId: string,
    status: ModerationStatus | undefined,
    skip: number,
    take: number,
  ) {
    const list = Array.from(this.posts.values())
      .filter((p) => p.userAccountId === userAccountId && (!status || p.status === status))
      .map((p) => ({
        id: p.id,
        categoryId: p.categoryId,
        content: p.content,
        imageUrl: p.imageUrl,
        mediaUrls: this.postMedia.get(p.id) ?? [],
        status: p.status,
        rejectionReason: p.rejectionReason,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));
    return Promise.resolve({ items: list.slice(skip, skip + take), total: list.length });
  }

  findViewerReactionsByPostIds(postIds: ReadonlyArray<string>, deviceId: string) {
    const map = new Map<string, ReactionType[]>();
    for (const postId of postIds) {
      const list: ReactionType[] = [];
      for (const key of this.reactions.values()) {
        const [rPostId, rDeviceId, rType] = key.split(':');
        if (rPostId === postId && rDeviceId === deviceId && rType) {
          list.push(rType as ReactionType);
        }
      }
      map.set(postId, list);
    }
    return Promise.resolve(map);
  }

  findBookmarkedPostIds(postIds: ReadonlyArray<string>, deviceId: string) {
    const set = new Set<string>();
    for (const postId of postIds) {
      if (this.bookmarks.has(`${postId}:${deviceId}`)) {
        set.add(postId);
      }
    }
    return Promise.resolve(set);
  }

  toggleBookmark(postId: string, deviceId: string): Promise<boolean> {
    const key = `${postId}:${deviceId}`;
    if (this.bookmarks.has(key)) {
      this.bookmarks.delete(key);
      return Promise.resolve(false);
    }
    this.bookmarks.add(key);
    return Promise.resolve(true);
  }

  findBookmarkedPostsPaginated(
    deviceId: string,
    _userAccountId: string | null,
    skip: number,
    take: number,
  ) {
    const bookmarkedIds = new Set<string>();
    for (const key of this.bookmarks.values()) {
      const [postId, bDeviceId] = key.split(':');
      if (postId && bDeviceId === deviceId) {
        bookmarkedIds.add(postId);
      }
    }
    const list = Array.from(this.posts.values()).filter(
      (p) => p.status === ModerationStatus.APPROVED && bookmarkedIds.has(p.id),
    );
    const items = list.slice(skip, skip + take).map((p) => {
      const session = this.sessions.get(p.deviceId);
      const user = p.userAccountId ? this.users.get(p.userAccountId) : undefined;
      return {
        id: p.id,
        categoryId: p.categoryId,
        content: p.content,
        imageUrl: p.imageUrl,
        mediaUrls: this.postMedia.get(p.id) ?? [],
        createdAt: p.createdAt,
        userAccountId: p.userAccountId,
        username: user?.username ?? null,
        rol: user?.rol ?? null,
        nickname: session?.nickname ?? null,
        roleTag: session?.roleTag ?? null,
      };
    });
    return Promise.resolve({ items, total: list.length });
  }

  countReactionsByPostIds(postIds: ReadonlyArray<string>) {
    const map = new Map<string, Record<ReactionType, number>>();
    for (const postId of postIds) {
      const counts = {
        [ReactionType.LIKE]: 0,
        [ReactionType.SUPPORT]: 0,
        [ReactionType.THANKS]: 0,
      };
      for (const key of this.reactions.values()) {
        const [rPostId, , rType] = key.split(':');
        if (rPostId === postId && rType && rType in counts) {
          counts[rType as ReactionType] += 1;
        }
      }
      map.set(postId, counts);
    }
    return Promise.resolve(map);
  }

  countApprovedCommentsByPostIds(postIds: ReadonlyArray<string>) {
    const map = new Map<string, number>();
    for (const postId of postIds) {
      const total = Array.from(this.comments.values()).filter(
        (c) => c.postId === postId && c.status === ModerationStatus.APPROVED,
      ).length;
      map.set(postId, total);
    }
    return Promise.resolve(map);
  }

  findRecentApprovedComments(postIds: ReadonlyArray<string>, perPostLimit: number) {
    const map = new Map<
      string,
      Array<{
        id: string;
        postId: string;
        parentId: string | null;
        content: string;
        createdAt: Date;
        userAccountId: string | null;
        username: string | null;
        rol: string | null;
        nickname: string | null;
        roleTag: string | null;
      }>
    >();
    for (const postId of postIds) {
      const approved = Array.from(this.comments.values())
        .filter((c) => c.postId === postId && c.status === ModerationStatus.APPROVED)
        .slice(0, perPostLimit)
        .map((c) => {
          const session = this.sessions.get(c.deviceId);
          const user = c.userAccountId ? this.users.get(c.userAccountId) : undefined;
          return {
            id: c.id,
            postId: c.postId,
            parentId: c.parentId,
            content: c.content,
            createdAt: c.createdAt,
            userAccountId: c.userAccountId,
            username: user?.username ?? null,
            rol: user?.rol ?? null,
            nickname: session?.nickname ?? null,
            roleTag: session?.roleTag ?? null,
          };
        });
      map.set(postId, approved);
    }
    return Promise.resolve(map);
  }

  create(data: {
    deviceId: string;
    userAccountId: string | null;
    categoryId?: string;
    postId?: string;
    parentId?: string | null;
    content: string;
    imageUrl?: string | null;
    mediaUrls?: ReadonlyArray<string>;
    status?: ModerationStatus;
    rejectionReason?: string | null;
  }): Promise<Post & Comment> {
    const now = new Date();
    if (data.categoryId) {
      const post: Post = {
        id: randomUUID(),
        deviceId: data.deviceId,
        userAccountId: data.userAccountId,
        categoryId: data.categoryId,
        content: data.content,
        imageUrl: data.imageUrl ?? null,
        status: data.status ?? ModerationStatus.PENDING,
        rejectionReason: data.rejectionReason ?? null,
        createdAt: now,
        updatedAt: now,
      };
      this.posts.set(post.id, post);
      if (data.mediaUrls && data.mediaUrls.length > 0) {
        this.postMedia.set(post.id, [...data.mediaUrls]);
      }
      return Promise.resolve(post as Post & Comment);
    }
    const comment: Comment = {
      id: randomUUID(),
      postId: data.postId ?? '',
      parentId: data.parentId ?? null,
      deviceId: data.deviceId,
      userAccountId: data.userAccountId,
      content: data.content,
      status: data.status ?? ModerationStatus.PENDING,
      rejectionReason: data.rejectionReason ?? null,
      createdAt: now,
    };
    this.comments.set(comment.id, comment);
    return Promise.resolve(comment as Post & Comment);
  }

  findApprovedByPostId(postId: string, skip: number, take: number) {
    const approved = Array.from(this.comments.values()).filter(
      (c) => c.postId === postId && c.status === ModerationStatus.APPROVED,
    );
    const items = approved.slice(skip, skip + take).map((c) => {
      const session = this.sessions.get(c.deviceId);
      const user = c.userAccountId ? this.users.get(c.userAccountId) : undefined;
      return {
        id: c.id,
        postId: c.postId,
        parentId: c.parentId,
        content: c.content,
        createdAt: c.createdAt,
        userAccountId: c.userAccountId,
        username: user?.username ?? null,
        rol: user?.rol ?? null,
        nickname: session?.nickname ?? null,
        roleTag: session?.roleTag ?? null,
        likesCount: 0,
      };
    });
    return Promise.resolve({ items, total: approved.length });
  }

  findStatusById(id: string): Promise<ModerationStatus | null> {
    return Promise.resolve(this.posts.get(id)?.status ?? null);
  }

  countPostsByDeviceSince(deviceId: string, since: Date): Promise<number> {
    const count = Array.from(this.posts.values()).filter(
      (p) => p.deviceId === deviceId && p.createdAt >= since,
    ).length;
    return Promise.resolve(count);
  }

  countCommentsByDeviceSince(deviceId: string, since: Date): Promise<number> {
    const count = Array.from(this.comments.values()).filter(
      (c) => c.deviceId === deviceId && c.createdAt >= since,
    ).length;
    return Promise.resolve(count);
  }

  toggle(
    postId: string,
    deviceId: string,
    _userAccountId: string | null,
    type: ReactionType,
  ): Promise<boolean> {
    const key = `${postId}:${deviceId}:${type}`;
    if (this.reactions.has(key)) {
      this.reactions.delete(key);
      return Promise.resolve(false);
    }
    this.reactions.add(key);
    return Promise.resolve(true);
  }

  toggleCommentReaction(
    commentId: string,
    deviceId: string,
    _userAccountId: string | null,
    type: ReactionType,
  ): Promise<boolean> {
    const key = `${commentId}:${deviceId}:${type}`;
    if (this.commentReactions.has(key)) {
      this.commentReactions.delete(key);
      return Promise.resolve(false);
    }
    this.commentReactions.add(key);
    return Promise.resolve(true);
  }

  findPending(type: 'POST' | 'COMMENT' | undefined, skip: number, take: number) {
    const items: Array<{
      id: string;
      itemType: 'POST' | 'COMMENT';
      postId: string | null;
      categoryId: string | null;
      content: string;
      imageUrl: string | null;
      deviceId: string;
      userAccountId: string | null;
      username: string | null;
      rol: string | null;
      nickname: string | null;
      roleTag: string | null;
      createdAt: Date;
    }> = [];

    if (!type || type === 'POST') {
      for (const p of this.posts.values()) {
        if (p.status === ModerationStatus.PENDING) {
          const session = this.sessions.get(p.deviceId);
          const user = p.userAccountId ? this.users.get(p.userAccountId) : undefined;
          items.push({
            id: p.id,
            itemType: 'POST',
            postId: null,
            categoryId: p.categoryId,
            content: p.content,
            imageUrl: p.imageUrl,
            deviceId: p.deviceId,
            userAccountId: p.userAccountId,
            username: user?.username ?? null,
            rol: user?.rol ?? null,
            nickname: session?.nickname ?? null,
            roleTag: session?.roleTag ?? null,
            createdAt: p.createdAt,
          });
        }
      }
    }

    if (!type || type === 'COMMENT') {
      for (const c of this.comments.values()) {
        if (c.status === ModerationStatus.PENDING) {
          const session = this.sessions.get(c.deviceId);
          const user = c.userAccountId ? this.users.get(c.userAccountId) : undefined;
          items.push({
            id: c.id,
            itemType: 'COMMENT',
            postId: c.postId,
            categoryId: null,
            content: c.content,
            imageUrl: null,
            deviceId: c.deviceId,
            userAccountId: c.userAccountId,
            username: user?.username ?? null,
            rol: user?.rol ?? null,
            nickname: session?.nickname ?? null,
            roleTag: session?.roleTag ?? null,
            createdAt: c.createdAt,
          });
        }
      }
    }

    return Promise.resolve({
      items: items.slice(skip, skip + take),
      total: items.length,
    });
  }

  updatePostStatus(
    id: string,
    status: ModerationStatus.APPROVED | ModerationStatus.REJECTED,
  ) {
    const post = this.posts.get(id);
    if (!post) {
      return Promise.resolve(null);
    }
    const updatedAt = new Date();
    const rejectionReason = status === ModerationStatus.REJECTED ? 'HUMAN' : null;
    this.posts.set(id, { ...post, status, rejectionReason, updatedAt });
    return Promise.resolve({ id, itemType: 'POST' as const, status, rejectionReason, updatedAt });
  }

  updateCommentStatus(
    id: string,
    status: ModerationStatus.APPROVED | ModerationStatus.REJECTED,
  ) {
    const comment = this.comments.get(id);
    if (!comment) {
      return Promise.resolve(null);
    }
    const updatedAt = new Date();
    const rejectionReason = status === ModerationStatus.REJECTED ? 'HUMAN' : null;
    this.comments.set(id, { ...comment, status, rejectionReason });
    return Promise.resolve({
      id,
      itemType: 'COMMENT' as const,
      status,
      rejectionReason,
      updatedAt,
    });
  }

  listModerators() {
    const list = Array.from(this.users.values())
      .filter((u) => u.localRole === 'MODERATOR' && u.isActive)
      .map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        rol: u.rol,
        localRole: u.localRole,
      }));
    return Promise.resolve(list);
  }

  setLocalRole(userAccountId: string, localRole: 'MODERATOR' | null) {
    const existing = this.users.get(userAccountId);
    if (!existing) {
      return Promise.resolve(null);
    }
    const updated: UserAccount = { ...existing, localRole };
    this.users.set(userAccountId, updated);
    return Promise.resolve({
      id: updated.id,
      username: updated.username,
      email: updated.email,
      rol: updated.rol,
      localRole: updated.localRole,
    });
  }

  targetExistsAndApproved(targetType: 'POST' | 'COMMENT', targetId: string): Promise<boolean> {
    if (targetType === 'POST') {
      const post = this.posts.get(targetId);
      return Promise.resolve(Boolean(post && post.status === ModerationStatus.APPROVED));
    }
    const comment = this.comments.get(targetId);
    return Promise.resolve(Boolean(comment && comment.status === ModerationStatus.APPROVED));
  }

  hasOpenReportByDevice(
    targetType: 'POST' | 'COMMENT',
    targetId: string,
    reporterDeviceId: string,
  ): Promise<boolean> {
    for (const r of this.contentReports.values()) {
      if (
        r.targetType === targetType &&
        r.targetId === targetId &&
        r.reporterDeviceId === reporterDeviceId &&
        r.status === 'OPEN'
      ) {
        return Promise.resolve(true);
      }
    }
    return Promise.resolve(false);
  }

  createContentReport(input: CreateContentReportInput): Promise<ContentReportRecord> {
    const record: ContentReportRecord = {
      id: randomUUID(),
      targetType: input.targetType,
      targetId: input.targetId,
      targetContentPreview:
        input.targetType === 'POST'
          ? (this.posts.get(input.targetId)?.content ?? null)
          : (this.comments.get(input.targetId)?.content ?? null),
      reason: input.reason,
      details: input.details,
      status: 'OPEN',
      reporterDeviceId: input.reporterDeviceId,
      reporterUserAccountId: input.reporterUserAccountId,
      resolvedByUserAccountId: null,
      resolvedAt: null,
      createdAt: new Date(),
    };
    this.contentReports.set(record.id, record);
    return Promise.resolve(record);
  }

  findContentReports(
    status: 'OPEN' | 'RESOLVED' | 'DISMISSED' | undefined,
    skip: number,
    take: number,
  ) {
    const list = Array.from(this.contentReports.values()).filter(
      (r) => !status || r.status === status,
    );
    return Promise.resolve({ items: list.slice(skip, skip + take), total: list.length });
  }

  resolveContentReport(
    reportId: string,
    status: 'RESOLVED' | 'DISMISSED',
    resolvedByUserAccountId: string | null,
  ): Promise<ContentReportRecord | null> {
    const existing = this.contentReports.get(reportId);
    if (!existing) {
      return Promise.resolve(null);
    }
    const updated: ContentReportRecord = {
      ...existing,
      status,
      resolvedByUserAccountId,
      resolvedAt: new Date(),
    };
    this.contentReports.set(reportId, updated);
    return Promise.resolve(updated);
  }

}

class InMemoryDirectoryRepo implements IRedirectionLinkRepository {
  private readonly directoryLinks = new Map<string, RedirectionLinkProjection>([
    [
      '22222222-2222-4222-8222-222222222222',
      {
        id: '22222222-2222-4222-8222-222222222222',
        projectName: 'SUMA 21',
        url: 'https://suma21.fundacionasisco.org',
        description: 'Inclusión social y formación integral.',
      },
    ],
  ]);

  findActivePaginated(skip: number, take: number) {
    const links = Array.from(this.directoryLinks.values());
    return Promise.resolve({ items: links.slice(skip, skip + take), total: links.length });
  }

  create(input: CreateRedirectionLinkInput): Promise<RedirectionLinkProjection> {
    const created: RedirectionLinkProjection = {
      id: randomUUID(),
      projectName: input.projectName,
      url: input.url,
      description: input.description,
    };
    this.directoryLinks.set(created.id, created);
    return Promise.resolve(created);
  }

  update(id: string, input: UpdateRedirectionLinkInput): Promise<RedirectionLinkProjection | null> {
    const existing = this.directoryLinks.get(id);
    if (!existing) {
      return Promise.resolve(null);
    }
    const updated: RedirectionLinkProjection = {
      ...existing,
      projectName: input.projectName ?? existing.projectName,
      url: input.url ?? existing.url,
      description: input.description ?? existing.description,
    };
    this.directoryLinks.set(id, updated);
    return Promise.resolve(updated);
  }

  deleteById(id: string): Promise<boolean> {
    return Promise.resolve(this.directoryLinks.delete(id));
  }
}

class InMemoryFaqRepo implements IFaqKnowledgeRepository {
  private readonly items = new Map<string, FaqKnowledgeProjection>([
    [
      '33333333-3333-4333-8333-333333333333',
      {
        id: '33333333-3333-4333-8333-333333333333',
        question: '¿Cómo inscribo a un beneficiario?',
        answer: 'Con autorización Ley 1581.',
        category: 'Inscripciones',
      },
    ],
  ]);

  findPaginated(category: string | undefined, skip: number, take: number) {
    const faqs = Array.from(this.items.values()).filter(
      (f) => !category || f.category.toLowerCase() === category.toLowerCase(),
    );
    return Promise.resolve({ items: faqs.slice(skip, skip + take), total: faqs.length });
  }

  create(input: CreateFaqKnowledgeInput): Promise<FaqKnowledgeProjection> {
    const created: FaqKnowledgeProjection = {
      id: randomUUID(),
      question: input.question,
      answer: input.answer,
      category: input.category,
    };
    this.items.set(created.id, created);
    return Promise.resolve(created);
  }

  update(id: string, input: UpdateFaqKnowledgeInput): Promise<FaqKnowledgeProjection | null> {
    const existing = this.items.get(id);
    if (!existing) {
      return Promise.resolve(null);
    }
    const updated: FaqKnowledgeProjection = {
      ...existing,
      question: input.question ?? existing.question,
      answer: input.answer ?? existing.answer,
      category: input.category ?? existing.category,
    };
    this.items.set(id, updated);
    return Promise.resolve(updated);
  }

  deleteById(id: string): Promise<boolean> {
    return Promise.resolve(this.items.delete(id));
  }
}

describe('Contract & E2E — AsisConexión MVP v2 (US1–US6, Render Auth, Actors, Auto-Filter, Moderators)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const store = new InMemoryPersistenceStore();
    const faqRepo = new InMemoryFaqRepo();
    const directoryRepo = new InMemoryDirectoryRepo();

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              PORT: 3000,
              NODE_ENV: 'test',
              USE_MOCK_EXTERNAL_SERVICES: true,
              DB_LOCAL_URL: 'postgresql://localhost:5432/asisconexion_db',
              JWT_SECRET: 'e2e_test_secret_with_at_least_32_characters_ok',
              JWT_EXPIRES_IN: '30d',
              ANON_MAX_POSTS_PER_DAY: 3,
              ANON_MAX_COMMENTS_PER_DAY: 10,
              WHATSAPP_SUPPORT_PHONE: '573001234567',
              WHATSAPP_DEFAULT_MESSAGE:
                'Hola Fundación Asisco, requiero acompañamiento humano desde AsisConexión.',
              ASSISTANT_ENGINE: 'faq',
            }),
          ],
        }),
        JwtModule.register({
          secret: 'e2e_test_secret_with_at_least_32_characters_ok',
          signOptions: { expiresIn: '30d' },
        }),
      ],
      controllers: [
        AuthSessionController,
        ActorsController,
        CategoriesController,
        PostsController,
        ModerationController,
        DirectoryController,
        AdminDirectoryController,
        AssistantController,
        AdminFaqsController,
      ],
      providers: [
        SessionTokenService,
        DeviceSessionGuard,
        OptionalDeviceSessionGuard,
        RolesGuard,
        { provide: DEVICE_SESSION_READER, useValue: store },
        { provide: USER_SYNC_REPOSITORY, useValue: store },
        { provide: ACTOR_REPOSITORY, useValue: store },
        { provide: RENDER_AUTH_ADAPTER, useClass: RenderAuthMockAdapter },
        { provide: CATEGORY_REPOSITORY, useValue: store },
        { provide: POST_REPOSITORY, useValue: store },
        { provide: COMMENT_REPOSITORY, useValue: store },
        { provide: REACTION_REPOSITORY, useValue: store },
        { provide: MODERATION_REPOSITORY, useValue: store },
        ProfanityContentRule,
        ExternalLinkContentRule,
        MinorDataContentRule,
        SpamContentRule,
        {
          provide: CONTENT_FILTER_RULES,
          inject: [
            ProfanityContentRule,
            ExternalLinkContentRule,
            MinorDataContentRule,
            SpamContentRule,
          ],
          useFactory: (
            profanity: ProfanityContentRule,
            extLink: ExternalLinkContentRule,
            minorData: MinorDataContentRule,
            spam: SpamContentRule,
          ): ReadonlyArray<IContentRule> => [profanity, extLink, minorData, spam],
        },
        ContentFilterService,
        { provide: REDIRECTION_LINK_REPOSITORY, useValue: directoryRepo },
        { provide: FAQ_KNOWLEDGE_REPOSITORY, useValue: faqRepo },
        { provide: ASSISTANT_ENGINE_PROVIDER, useClass: FaqRuleEngineProvider },
        AuthSessionService,
        ActorsService,
        CategoriesService,
        PostsService,
        ModerationService,
        DirectoryService,
        AssistantService,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        exceptionFactory: validationExceptionFactory,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('ejecuta el flujo completo v2: login/registro Render, Actor exclusivo para registrados, filtro automático, moderadores y reacciones', async () => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];

    // 1. Sesión anónima no tiene perfil Actor (403 Forbidden)
    const anonRes = await request(httpServer)
      .post('/v1/sessions/anonymous')
      .send({ nickname: 'AcudienteNorte', role_tag: 'ACUDIENTE', accept_consent: true })
      .expect(201);
    const anonBody = anonRes.body as { device_token: string; session_id: string };

    await request(httpServer)
      .get('/v1/actors/me')
      .set('Authorization', `Bearer ${anonBody.device_token}`)
      .expect(403);

    // 2. Registro de usuario crea UserAccount + Actor 1:1
    const regRes = await request(httpServer)
      .post('/v1/auth/registro')
      .set('Authorization', `Bearer ${anonBody.device_token}`)
      .send({
        username: 'lucia.acudiente',
        email: 'lucia@prueba.com',
        clave: 'ClaveAcudiente2026',
        rol: 'ACUDIENTE',
        accept_consent: true,
      })
      .expect(201);
    const regBody = regRes.body as {
      user: { id: string; username: string };
      device_token: string;
    };

    const myActorRes = await request(httpServer)
      .patch('/v1/actors/me')
      .set('Authorization', `Bearer ${regBody.device_token}`)
      .send({ first_names: 'Lucía', last_names: 'Pineda', short_bio: 'Acudiente activa' })
      .expect(200);
    expect((myActorRes.body as { first_names: string }).first_names).toBe('Lucía');

    // 3. Filtro automático rechaza enlaces externos con status = REJECTED y rejection_reason = AUTO_FILTER
    const autoRejectedRes = await request(httpServer)
      .post('/v1/posts')
      .set('Authorization', `Bearer ${regBody.device_token}`)
      .send({
        category_id: '11111111-1111-4111-8111-111111111111',
        content: 'Visiten https://sitio-externo.com para ganar premios.',
      })
      .expect(201);
    expect(autoRejectedRes.body).toMatchObject({
      status: 'REJECTED',
      rejection_reason: 'AUTO_FILTER',
    });

    // 4. Publicación limpia con media_urls entra directamente con status = APPROVED
    const postRes = await request(httpServer)
      .post('/v1/posts')
      .set('Authorization', `Bearer ${regBody.device_token}`)
      .send({
        category_id: '11111111-1111-4111-8111-111111111111',
        content: 'Comparto nuestra experiencia positiva en los talleres familiares.',
        media_urls: ['https://cdn.asisco.org/fotos/taller1.jpg'],
      })
      .expect(201);
    const postBody = postRes.body as { id: string; status: string };
    expect(postBody.status).toBe('APPROVED');

    // 4b. Comentario con palabra vulgar es rechazado por ContentFilterService (AUTO_FILTER) y comentario limpio entra directo como APPROVED
    const rejectedCommentRes = await request(httpServer)
      .post(`/v1/posts/${postBody.id}/comments`)
      .set('Authorization', `Bearer ${regBody.device_token}`)
      .send({ content: 'Eso fue una mierda total' })
      .expect(201);
    expect(rejectedCommentRes.body).toMatchObject({
      status: 'REJECTED',
      rejection_reason: 'AUTO_FILTER',
    });

    const approvedCommentRes = await request(httpServer)
      .post(`/v1/posts/${postBody.id}/comments`)
      .set('Authorization', `Bearer ${regBody.device_token}`)
      .send({ content: 'Muchas gracias por compartir esta experiencia tan valiosa.' })
      .expect(201);
    expect((approvedCommentRes.body as { status: string }).status).toBe('APPROVED');

    // 5. Login de ADMIN en /v1/auth/login y promoción de lucia.acudiente a MODERATOR global
    const adminLogin = await request(httpServer)
      .post('/v1/auth/login')
      .send({
        email: 'admin@asisco.org',
        clave: 'ClaveAsisco2026',
        accept_consent: true,
      })
      .expect(200);
    const adminToken = (adminLogin.body as { device_token: string }).device_token;

    await request(httpServer)
      .put(`/v1/admin/moderators/${regBody.user.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // 6. Ahora lucia.acudiente (MODERATOR) puede aprobar el post, pero NO puede gestionar otros moderadores (403)
    await request(httpServer)
      .get('/v1/admin/moderators')
      .set('Authorization', `Bearer ${regBody.device_token}`)
      .expect(403);

    await request(httpServer)
      .patch(`/v1/admin/moderation/posts/${postBody.id}/status`)
      .set('Authorization', `Bearer ${regBody.device_token}`)
      .send({ status: 'APPROVED' })
      .expect(200);

    const approvedFeed = await request(httpServer)
      .get('/v1/posts?page=1&limit=20')
      .expect(200);
    const feedItems = (approvedFeed.body as { data: Array<{ media_urls: string[] }> }).data;
    expect(feedItems).toHaveLength(1);
    expect(feedItems[0]?.media_urls).toEqual(['https://cdn.asisco.org/fotos/taller1.jpg']);
  });

  it('ejecuta los 5 nuevos casos de uso de Red Social (CU-01 a CU-05): descubrimiento, feed following, edición RN-02, bookmarks y reportes comunitarios', async () => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];

    // Registrar dos usuarios para probar grafo social y feed following
    const userARes = await request(httpServer)
      .post('/v1/auth/registro')
      .send({
        username: 'andres.voluntario',
        email: 'andres@prueba.com',
        clave: 'ClaveVoluntario2026',
        rol: 'VOLUNTARIO',
        accept_consent: true,
      })
      .expect(201);
    const tokenA = (userARes.body as { device_token: string }).device_token;

    const userBRes = await request(httpServer)
      .post('/v1/auth/registro')
      .send({
        username: 'camila.acudiente',
        email: 'camila@prueba.com',
        clave: 'ClaveAcudiente2026',
        rol: 'ACUDIENTE',
        accept_consent: true,
      })
      .expect(201);
    const tokenB = (userBRes.body as { device_token: string }).device_token;

    // CU-01: Descubrimiento de perfiles en GET /v1/actors?search=andres
    const searchActorsRes = await request(httpServer)
      .get('/v1/actors?search=andres')
      .expect(200);
    const foundActors = (searchActorsRes.body as { data: Array<{ id: string; username: string }> })
      .data;
    expect(foundActors.length).toBeGreaterThanOrEqual(1);
    const actorAId = foundActors[0]!.id;

    // Camila sigue a Andrés (auto-aceptado porque require_follow_approval = false por defecto)
    const connRes = await request(httpServer)
      .post('/v1/connections')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ receiver_actor_id: actorAId })
      .expect(201);
    const connectionId = (connRes.body as { id: string; status: string }).id;

    // Consultar perfil de Andrés autenticado como Camila devuelve viewer_connection
    const profileARes = await request(httpServer)
      .get(`/v1/actors/${actorAId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(
      (profileARes.body as { viewer_connection: { connection_id: string; status: string } })
        .viewer_connection,
    ).toMatchObject({
      connection_id: connectionId,
      status: 'ACCEPTED',
    });

    // Listar seguidores de Andrés
    const followersRes = await request(httpServer)
      .get(`/v1/actors/${actorAId}/followers`)
      .expect(200);
    expect((followersRes.body as { meta: { total_items: number } }).meta.total_items).toBe(1);

    // Andrés crea una publicación con hashtag #InclusionAsisco y el ADMIN la aprueba
    const postARes = await request(httpServer)
      .post('/v1/posts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        category_id: '11111111-1111-4111-8111-111111111111',
        content: 'Jornada de lectura comunitaria #InclusionAsisco con las familias.',
      })
      .expect(201);
    const postAId = (postARes.body as { id: string }).id;

    const adminLogin = await request(httpServer)
      .post('/v1/auth/login')
      .send({
        email: 'admin@asisco.org',
        clave: 'ClaveAsisco2026',
        accept_consent: true,
      })
      .expect(200);
    const adminToken = (adminLogin.body as { device_token: string }).device_token;

    await request(httpServer)
      .patch(`/v1/admin/moderation/posts/${postAId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' })
      .expect(200);

    // CU-02 & CU-04: Camila consulta el feed following con búsqueda por hashtag, reacciona y guarda el post en bookmarks
    const followingFeedRes = await request(httpServer)
      .get('/v1/posts?feed=following&search=%23InclusionAsisco')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    const followingPosts = (followingFeedRes.body as { data: Array<{ id: string }> }).data;
    expect(followingPosts.map((p) => p.id)).toContain(postAId);

    const toggleBookmarkRes = await request(httpServer)
      .post(`/v1/posts/${postAId}/bookmarks`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(toggleBookmarkRes.body).toEqual({ post_id: postAId, bookmarked: true });

    const bookmarksPage = await request(httpServer)
      .get('/v1/bookmarks')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect((bookmarksPage.body as { data: Array<{ id: string }> }).data[0]?.id).toBe(postAId);

    // Detalle individual de publicación refleja is_bookmarked = true
    const detailRes = await request(httpServer)
      .get(`/v1/posts/${postAId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect((detailRes.body as { is_bookmarked: boolean }).is_bookmarked).toBe(true);

    // CU-05: Camila reporta la publicación y un segundo reporte idéntico devuelve 409 Conflict
    const reportRes = await request(httpServer)
      .post('/v1/reports')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        target_type: 'POST',
        target_id: postAId,
        reason: 'OTHER',
        details: 'Solicito revisión de datos en la publicación.',
      })
      .expect(201);
    const reportId = (reportRes.body as { id: string; status: string }).id;

    await request(httpServer)
      .post('/v1/reports')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        target_type: 'POST',
        target_id: postAId,
        reason: 'OTHER',
      })
      .expect(409);

    // El ADMIN lista los reportes abiertos y lo descarta (DISMISSED)
    const openReportsRes = await request(httpServer)
      .get('/v1/admin/moderation/reports?status=OPEN')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((openReportsRes.body as { data: Array<{ id: string }> }).data.map((r) => r.id)).toContain(
      reportId,
    );

    await request(httpServer)
      .patch(`/v1/admin/moderation/reports/${reportId}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'DISMISSED' })
      .expect(200);

    // CU-03: Andrés edita su publicación -> permanece en APPROVED si supera el filtro automático y aparece en /v1/actors/me/submissions
    const editRes = await request(httpServer)
      .patch(`/v1/posts/${postAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ content: 'Jornada de lectura comunitaria actualizada.' })
      .expect(200);
    expect((editRes.body as { status: string }).status).toBe('APPROVED');

    const mySubmissionsRes = await request(httpServer)
      .get('/v1/actors/me/submissions?status=APPROVED')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(
      (mySubmissionsRes.body as { data: Array<{ id: string }> }).data.map((s) => s.id),
    ).toContain(postAId);

    // BK-01: El ADMIN crea, actualiza y elimina una FAQ en /v1/admin/faqs
    const createdFaqRes = await request(httpServer)
      .post('/v1/admin/faqs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        question: '¿Cómo participar en talleres?',
        answer: 'Inscríbete desde los canales oficiales de ASISCO UP.',
        category: 'Talleres',
      })
      .expect(201);
    const createdFaqId = (createdFaqRes.body as { id: string }).id;

    await request(httpServer)
      .patch(`/v1/admin/faqs/${createdFaqId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ category: 'Formación' })
      .expect(200);

    await request(httpServer)
      .delete(`/v1/admin/faqs/${createdFaqId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // BK-01: El ADMIN crea, actualiza y elimina un enlace en /v1/admin/directory/links
    const createdLinkRes = await request(httpServer)
      .post('/v1/admin/directory/links')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        project_name: 'Red Familias ASISCO',
        url: 'https://familias.fundacionasisco.org',
        description: 'Red de acompañamiento familiar.',
      })
      .expect(201);
    const createdLinkId = (createdLinkRes.body as { id: string }).id;

    await request(httpServer)
      .patch(`/v1/admin/directory/links/${createdLinkId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ project_name: 'Red Familias ASISCO UP' })
      .expect(200);

    await request(httpServer)
      .delete(`/v1/admin/directory/links/${createdLinkId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // BK-06: No se permite autoasignar rol ADMIN en registro público
    await request(httpServer)
      .post('/v1/auth/registro')
      .send({
        username: 'hacker.admin',
        email: 'hacker@prueba.com',
        clave: 'ClaveSegura2026',
        rol: 'ADMIN',
        accept_consent: true,
      })
      .expect(400);

    // Andrés elimina su publicación y Camila deja de seguir a Andrés
    await request(httpServer)
      .delete(`/v1/posts/${postAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    await request(httpServer)
      .delete(`/v1/connections/${connectionId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
  });
});
