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
import { AssistantController } from '../../src/modules/assistant/assistant.controller';
import { AssistantService } from '../../src/modules/assistant/assistant.service';
import { ASSISTANT_ENGINE_PROVIDER } from '../../src/modules/assistant/interfaces/i-assistant-engine.provider';
import {
  FAQ_KNOWLEDGE_REPOSITORY,
  type IFaqKnowledgeRepository,
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
  type UpdateActorFields,
} from '../../src/modules/auth-session/interfaces/i-actor.repository';
import {
  type CreateAnonymousSessionInput,
  type IUserSyncRepository,
  type SyncUserSessionInput,
  USER_SYNC_REPOSITORY,
} from '../../src/modules/auth-session/interfaces/i-local-user.repository';
import { RENDER_AUTH_ADAPTER } from '../../src/modules/auth-session/interfaces/i-render-auth.adapter';
import { DirectoryController } from '../../src/modules/directory/directory.controller';
import { DirectoryService } from '../../src/modules/directory/directory.service';
import {
  type IRedirectionLinkRepository,
  REDIRECTION_LINK_REPOSITORY,
} from '../../src/modules/directory/interfaces/i-redirection-link.repository';
import { ContentFilterService } from '../../src/modules/moderation/content-filter.service';
import {
  CONTENT_FILTER_RULES,
  type IContentRule,
} from '../../src/modules/moderation/interfaces/i-content-rule.interface';
import {
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
  type IPostRepository,
  POST_REPOSITORY,
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
    IModerationRepository,
    IRedirectionLinkRepository
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

  findById(id: string): Promise<(Actor & Comment) | null> {
    const found = this.actors.get(id) ?? this.comments.get(id) ?? null;
    return Promise.resolve(found as (Actor & Comment) | null);
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

  createConnection(requesterActorId: string, receiverActorId: string): Promise<ActorConnection> {
    const connection: ActorConnection = {
      id: randomUUID(),
      requesterActorId,
      requesterActor: this.actors.get(requesterActorId)!,
      receiverActorId,
      receiverActor: this.actors.get(receiverActorId)!,
      status: 'PENDING',
      requestedAt: new Date(),
      acceptedAt: null,
    };
    this.actorConnections.set(connection.id, connection);
    return Promise.resolve(connection);
  }

  findConnectionById(connectionId: string): Promise<ActorConnection | null> {
    return Promise.resolve(this.actorConnections.get(connectionId) ?? null);
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

  listConnectionsForActor(actorId: string, skip: number, take: number) {
    const list = Array.from(this.actorConnections.values()).filter(
      (c) => c.requesterActorId === actorId || c.receiverActorId === actorId,
    );
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

  findApprovedPaginated(categoryId: string | undefined, skip: number, take: number) {
    const approved = Array.from(this.posts.values()).filter(
      (p) => p.status === ModerationStatus.APPROVED && (!categoryId || p.categoryId === categoryId),
    );
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

  findActivePaginated(skip: number, take: number) {
    const links = [
      {
        id: '22222222-2222-4222-8222-222222222222',
        projectName: 'SUMA 21',
        url: 'https://suma21.fundacionasisco.org',
        description: 'Inclusión social y formación integral.',
      },
    ];
    return Promise.resolve({ items: links.slice(skip, skip + take), total: links.length });
  }
}

class InMemoryFaqRepo implements IFaqKnowledgeRepository {
  findPaginated(category: string | undefined, skip: number, take: number) {
    const faqs = [
      {
        id: '33333333-3333-4333-8333-333333333333',
        question: '¿Cómo inscribo a un beneficiario?',
        answer: 'Con autorización Ley 1581.',
        category: 'Inscripciones',
      },
    ].filter((f) => !category || f.category.toLowerCase() === category.toLowerCase());
    return Promise.resolve({ items: faqs.slice(skip, skip + take), total: faqs.length });
  }
}

describe('Contract & E2E — AsisConexión MVP v2 (US1–US6, Render Auth, Actors, Auto-Filter, Moderators)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const store = new InMemoryPersistenceStore();
    const faqRepo = new InMemoryFaqRepo();

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
        AssistantController,
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
        { provide: REDIRECTION_LINK_REPOSITORY, useValue: store },
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

    // 4. Publicación limpia con media_urls pasa a PENDING
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
    expect(postBody.status).toBe('PENDING');

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
});
