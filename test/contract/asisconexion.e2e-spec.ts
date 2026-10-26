import '../../src/common/types/express';
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
import { RenderAuthMockAdapter } from '../../src/modules/auth-session/adapters/render-auth.mock-adapter';
import { AuthSessionController } from '../../src/modules/auth-session/auth-session.controller';
import { AuthSessionService } from '../../src/modules/auth-session/auth-session.service';
import type { DeviceSession } from '../../src/modules/auth-session/entities/device-session.entity';
import type { UserAccount } from '../../src/modules/auth-session/entities/user-account.entity';
import { GLOBAL_USER_REPOSITORY } from '../../src/modules/auth-session/interfaces/i-global-user.repository';
import {
  type CreateAnonymousSessionInput,
  type IUserSyncRepository,
  type SyncUserSessionInput,
  USER_SYNC_REPOSITORY,
} from '../../src/modules/auth-session/interfaces/i-local-user.repository';
import { RENDER_AUTH_ADAPTER } from '../../src/modules/auth-session/interfaces/i-render-auth.adapter';
import { GlobalUserMockRepository } from '../../src/modules/auth-session/repositories/global-user.mock-repository';
import { DirectoryController } from '../../src/modules/directory/directory.controller';
import { DirectoryService } from '../../src/modules/directory/directory.service';
import {
  type IRedirectionLinkRepository,
  REDIRECTION_LINK_REPOSITORY,
} from '../../src/modules/directory/interfaces/i-redirection-link.repository';
import {
  type IModerationRepository,
  MODERATION_REPOSITORY,
} from '../../src/modules/moderation/interfaces/i-moderation.repository';
import { ModerationController } from '../../src/modules/moderation/moderation.controller';
import { ModerationService } from '../../src/modules/moderation/moderation.service';
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
    IDeviceSessionReader,
    ICategoryRepository,
    IPostRepository,
    ICommentRepository,
    IReactionRepository,
    IModerationRepository,
    IRedirectionLinkRepository,
    IFaqKnowledgeRepository
{
  readonly users = new Map<string, UserAccount>();
  readonly sessions = new Map<string, DeviceSession>();
  readonly categories = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Apoyo Pedagógico',
      description: 'Experiencias educativas y acompañamiento familiar.',
    },
  ];
  readonly posts = new Map<string, Post>();
  readonly comments = new Map<string, Comment>();
  readonly reactions = new Set<string>();

  findByIdentity(
    externalUserId: string | null,
    username: string,
    email: string,
  ): Promise<UserAccount | null> {
    for (const user of this.users.values()) {
      if (
        (externalUserId && user.externalUserId === externalUserId) ||
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
  ): Promise<{ user: UserAccount; session: DeviceSession }> {
    const existing = await this.findByIdentity(input.externalUserId, input.username, input.email);
    if (existing && !existing.isActive) {
      throw new UnauthorizedException('Cuenta inactiva');
    }

    const now = new Date();
    const user: UserAccount = existing
      ? {
          ...existing,
          externalUserId: input.externalUserId ?? existing.externalUserId,
          username: input.username,
          email: input.email,
          rol: input.rol,
          lastSyncedAt: now,
        }
      : {
          id: randomUUID(),
          externalUserId: input.externalUserId,
          username: input.username,
          email: input.email,
          rol: input.rol,
          isActive: true,
          lastSyncedAt: now,
          createdAt: now,
        };
    this.users.set(user.id, user);

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
    return { user, session };
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
    content: string;
    imageUrl?: string | null;
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
        status: ModerationStatus.PENDING,
        createdAt: now,
        updatedAt: now,
      };
      this.posts.set(post.id, post);
      return Promise.resolve(post as Post & Comment);
    }
    const comment: Comment = {
      id: randomUUID(),
      postId: data.postId ?? '',
      deviceId: data.deviceId,
      userAccountId: data.userAccountId,
      content: data.content,
      status: ModerationStatus.PENDING,
      createdAt: now,
    };
    this.comments.set(comment.id, comment);
    return Promise.resolve(comment as Post & Comment);
  }

  findStatusById(id: string): Promise<ModerationStatus | null> {
    return Promise.resolve(this.posts.get(id)?.status ?? null);
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
    this.posts.set(id, { ...post, status, updatedAt });
    return Promise.resolve({ id, itemType: 'POST' as const, status, updatedAt });
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
    this.comments.set(id, { ...comment, status });
    return Promise.resolve({ id, itemType: 'COMMENT' as const, status, updatedAt });
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

describe('Contract & E2E — AsisConexión MVP (US1–US5, RFC 7807, RN-02, RT-01)', () => {
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
        { provide: GLOBAL_USER_REPOSITORY, useClass: GlobalUserMockRepository },
        { provide: RENDER_AUTH_ADAPTER, useClass: RenderAuthMockAdapter },
        { provide: CATEGORY_REPOSITORY, useValue: store },
        { provide: POST_REPOSITORY, useValue: store },
        { provide: COMMENT_REPOSITORY, useValue: store },
        { provide: REACTION_REPOSITORY, useValue: store },
        { provide: MODERATION_REPOSITORY, useValue: store },
        { provide: REDIRECTION_LINK_REPOSITORY, useValue: store },
        { provide: FAQ_KNOWLEDGE_REPOSITORY, useValue: faqRepo },
        { provide: ASSISTANT_ENGINE_PROVIDER, useClass: FaqRuleEngineProvider },
        AuthSessionService,
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

  it('ejecuta el flujo completo quickstart (Pasos 1–5), RN-02, RT-01 y errores RFC 7807', async () => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];

    // 400 RFC 7807 cuando accept_consent es false (Ley 1581)
    const missingConsent = await request(httpServer)
      .post('/v1/sessions/anonymous')
      .send({ nickname: 'Visitante', accept_consent: false })
      .expect(400);
    expect(missingConsent.headers['content-type']).toContain('application/problem+json');
    expect((missingConsent.body as Record<string, unknown>)['status']).toBe(400);

    // Paso 1: Sesión rápida anónima
    const anonRes = await request(httpServer)
      .post('/v1/sessions/anonymous')
      .send({ nickname: 'AcudienteNorte', role_tag: 'ACUDIENTE', accept_consent: true })
      .expect(201);
    const anonBody = anonRes.body as { device_token: string; session_id: string };
    expect(anonBody.device_token).toBeDefined();

    // Paso 2: Registro sincronizado vinculando sesión anónima previa (sin exponer clave)
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
      user: Record<string, unknown>;
      device_token: string;
      synced_with_global_db: boolean;
    };
    expect(regBody.user['username']).toBe('lucia.acudiente');
    expect(regBody.user['clave']).toBeUndefined();

    // 409 Conflict RFC 7807 por duplicado
    const dupRes = await request(httpServer)
      .post('/v1/auth/registro')
      .send({
        username: 'maria.acudiente',
        email: 'maria@prueba.com',
        clave: 'ClaveAcudiente2026',
        rol: 'ACUDIENTE',
        accept_consent: true,
      })
      .expect(409);
    expect(dupRes.headers['content-type']).toContain('application/problem+json');

    // 401 RFC 7807 sin token en escritura protegida
    await request(httpServer)
      .post('/v1/posts')
      .send({
        category_id: '11111111-1111-4111-8111-111111111111',
        content: 'Intento sin sesión',
      })
      .expect(401);

    // Paso 3: Crear Post (nace en PENDING y no aparece aún en público — RN-02)
    const postRes = await request(httpServer)
      .post('/v1/posts')
      .set('Authorization', `Bearer ${regBody.device_token}`)
      .send({
        category_id: '11111111-1111-4111-8111-111111111111',
        content: 'Comparto nuestra experiencia positiva en los talleres familiares.',
      })
      .expect(201);
    const postBody = postRes.body as { id: string; status: string };
    expect(postBody.status).toBe('PENDING');

    const emptyPublicFeed = await request(httpServer)
      .get('/v1/posts?page=1&limit=20')
      .expect(200);
    expect((emptyPublicFeed.body as { data: unknown[] }).data).toHaveLength(0);

    // 403 RFC 7807 cuando usuario no-ADMIN intenta moderar
    await request(httpServer)
      .get('/v1/admin/moderation/pending')
      .set('Authorization', `Bearer ${regBody.device_token}`)
      .expect(403);

    // Paso 2b & 4: Sincronizar ADMIN y aprobar publicación
    const adminSync = await request(httpServer)
      .post('/v1/auth/sync-session')
      .send({
        identifier: 'admin.asisco',
        clave: 'ClaveAsisco2026',
        accept_consent: true,
      })
      .expect(200);
    const adminToken = (adminSync.body as { device_token: string }).device_token;

    const pendingQueue = await request(httpServer)
      .get('/v1/admin/moderation/pending?page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((pendingQueue.body as { data: unknown[] }).data).toHaveLength(1);

    await request(httpServer)
      .patch(`/v1/admin/moderation/posts/${postBody.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' })
      .expect(200);

    // Verificar visibilidad en muro público y toggle de reacciones
    const approvedFeed = await request(httpServer)
      .get('/v1/posts?page=1&limit=20')
      .expect(200);
    expect((approvedFeed.body as { data: unknown[] }).data).toHaveLength(1);

    const toggle1 = await request(httpServer)
      .post(`/v1/posts/${postBody.id}/reactions`)
      .set('Authorization', `Bearer ${regBody.device_token}`)
      .send({ type: 'SUPPORT' })
      .expect(200);
    expect((toggle1.body as { active: boolean }).active).toBe(true);

    const toggle2 = await request(httpServer)
      .post(`/v1/posts/${postBody.id}/reactions`)
      .set('Authorization', `Bearer ${regBody.device_token}`)
      .send({ type: 'SUPPORT' })
      .expect(200);
    expect((toggle2.body as { active: boolean }).active).toBe(false);

    // Paso 5: Directorio Satélite y Asistente FAQ + Escalamiento WhatsApp
    const dirRes = await request(httpServer).get('/v1/directory/links?page=1&limit=20').expect(200);
    expect((dirRes.body as { data: Array<{ project_name: string }> }).data[0]?.project_name).toBe(
      'SUMA 21',
    );

    const faqRes = await request(httpServer).get('/v1/assistant/faqs?page=1&limit=20').expect(200);
    const faqBody = faqRes.body as { disclaimer: string; data: unknown[] };
    expect(faqBody.disclaimer).toContain('orientación automatizada');
    expect(faqBody.data).toHaveLength(1);

    const escRes = await request(httpServer)
      .post('/v1/assistant/escalate')
      .send({ topic: 'Inscripción SUMA 21' })
      .expect(200);
    expect((escRes.body as { whatsapp_url: string }).whatsapp_url).toContain(
      'https://wa.me/573001234567?text=',
    );
  });
});
