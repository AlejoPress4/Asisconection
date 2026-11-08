import { PaginationQueryDto } from '../../src/common/dto/pagination-query.dto';
import { ModerationStatus } from '../../src/common/enums/moderation-status.enum';
import { redactSensitiveFields } from '../../src/common/utils/redact.util';
import { preserveRawConsentValue } from '../../src/common/utils/strict-boolean.util';
import { validate } from '../../src/config/env.validation';
import { ASSISTANT_DISCLAIMER } from '../../src/modules/assistant/assistant.constants';
import { FaqRuleEngineProvider } from '../../src/modules/assistant/providers/faq-rule-engine.provider';
import { ContentFilterService } from '../../src/modules/moderation/content-filter.service';
import { ExternalLinkContentRule } from '../../src/modules/moderation/rules/external-link.rule';
import { MinorDataContentRule } from '../../src/modules/moderation/rules/minor-data.rule';
import { ProfanityContentRule } from '../../src/modules/moderation/rules/profanity.rule';
import { SpamContentRule } from '../../src/modules/moderation/rules/spam.rule';
import { PostsService, buildAuthorBadge } from '../../src/modules/social/services/posts.service';

describe('Unit — Seguridad Constitucional, Filtro Automático (OCP) y Asistente FAQ', () => {
  it('redacta campos sensibles (clave, password, authorization, device_token) recursivamente', () => {
    const raw = {
      username: 'lucia.acudiente',
      clave: 'SecretoSuperSensible123',
      nested: {
        device_token: 'eyJhbGciOi...',
        authorization: 'Bearer token',
        safe: 'visible',
      },
    };

    const sanitized = redactSensitiveFields(raw) as Record<string, unknown>;
    expect(sanitized['username']).toBe('lucia.acudiente');
    expect(sanitized['clave']).toBe('[REDACTED]');
    const nested = sanitized['nested'] as Record<string, unknown>;
    expect(nested['device_token']).toBe('[REDACTED]');
    expect(nested['authorization']).toBe('[REDACTED]');
    expect(nested['safe']).toBe('visible');
  });

  it('normaliza el alias RENDER_AUTH_API_URL hacia RENDER_API_URL sin exigir DB_GLOBAL_URL', () => {
    const validated = validate({
      DB_LOCAL_URL: 'postgresql://localhost:5432/asisconexion_db',
      RENDER_AUTH_API_URL: 'https://proyecto-integrador-backend-g2.onrender.com',
      USE_MOCK_EXTERNAL_SERVICES: 'false',
      JWT_SECRET: 'secreto_de_pruebas_con_mas_de_32_caracteres_seguros',
      WHATSAPP_SUPPORT_PHONE: '573001234567',
    });

    expect(validated.RENDER_API_URL).toBe('https://proyecto-integrador-backend-g2.onrender.com');
    expect(validated.USE_MOCK_EXTERNAL_SERVICES).toBe(false);
    expect(validated.ANON_MAX_POSTS_PER_DAY).toBe(3);
    expect(validated.ANON_MAX_COMMENTS_PER_DAY).toBe(10);
    expect(preserveRawConsentValue({ obj: { accept_consent: 'false' } })).toBe('false');
    expect(preserveRawConsentValue({ obj: { accept_consent: true } })).toBe(true);
  });

  it('FaqRuleEngineProvider adjunta siempre ASSISTANT_DISCLAIMER detrás de IAssistantEngineProvider', async () => {
    const faqEngine = new FaqRuleEngineProvider({
      findPaginated: () =>
        Promise.resolve({
          items: [
            {
              id: '550e8400-e29b-41d4-a716-446655440000',
              question: '¿Cómo inscribo a un beneficiario?',
              answer: 'Con documento y consentimiento Ley 1581.',
              category: 'Inscripciones',
            },
          ],
          total: 1,
        }),
    });

    const result = await faqEngine.resolveFaqs({ page: 1, limit: 20 });
    expect(result.disclaimer).toBe(ASSISTANT_DISCLAIMER);
    expect(result.items).toHaveLength(1);
    expect(result.totalItems).toBe(1);
  });

  it('ContentFilterService detecta groserías, enlaces externos, datos de menores y spam (-> REJECTED AUTO_FILTER)', () => {
    const filter = new ContentFilterService([
      new ProfanityContentRule(),
      new ExternalLinkContentRule(),
      new MinorDataContentRule(),
      new SpamContentRule(),
    ]);

    expect(filter.evaluate('Compartimos una hermosa actividad familiar.')).toEqual({
      status: ModerationStatus.PENDING,
      rejectionReason: null,
      triggeredRule: null,
      detail: null,
    });

    expect(filter.evaluate('Ese taller fue una mierda total').status).toBe(
      ModerationStatus.REJECTED,
    );
    expect(filter.evaluate('Entren ya a https://sitio-externo.com/promo').rejectionReason).toBe(
      'AUTO_FILTER',
    );
    expect(
      filter.evaluate('El menor Juan Perez tiene TI 1029384756 y teléfono 3001234567').triggeredRule,
    ).toBe('MINOR_SENSITIVE_DATA');
    expect(filter.evaluate('aaaaaaaaaaaaaaa texto repetido').triggeredRule).toBe('SPAM');
  });

  it('buildAuthorBadge incluye actor_id y avatar_url cuando están presentes', () => {
    expect(
      buildAuthorBadge({
        userAccountId: 'u-1',
        actorId: 'actor-1',
        avatarUrl: 'https://cdn.asisco.org/avatar.jpg',
        username: 'lucia.acudiente',
        rol: 'ACUDIENTE',
        nickname: null,
        roleTag: null,
      }),
    ).toEqual({
      actor_id: 'actor-1',
      display_name: 'lucia.acudiente',
      role_label: 'ACUDIENTE',
      avatar_url: 'https://cdn.asisco.org/avatar.jpg',
      is_registered: true,
    });
  });

  it('PostsService lista comentarios aprobados con likes_count y notificaciones recientes de los últimos 30 días', async () => {
    const now = new Date();
    const service = new PostsService(
      {
        findPaginated: () => Promise.resolve({ items: [], total: 0 }),
        existsById: () => Promise.resolve(true),
      },
      {
        findApprovedPaginated: () =>
          Promise.resolve({
            items: [
              {
                id: 'post-1',
                categoryId: 'cat-1',
                content: 'Mi publicación',
                imageUrl: null,
                createdAt: now,
                userAccountId: 'u-owner',
                username: 'lucia.acudiente',
                rol: 'ACUDIENTE',
                nickname: null,
                roleTag: null,
              },
            ],
            total: 1,
          }),
        countReactionsByPostIds: () => Promise.resolve(new Map()),
        countApprovedCommentsByPostIds: () => Promise.resolve(new Map()),
        findRecentApprovedComments: () =>
          Promise.resolve(
            new Map([
              [
                'post-1',
                [
                  {
                    id: 'comment-1',
                    postId: 'post-1',
                    parentId: null,
                    content: '¡Excelente iniciativa!',
                    createdAt: now,
                    userAccountId: 'u-other',
                    actorId: 'actor-other',
                    username: 'Carlos Voluntario',
                    rol: 'VOLUNTARIO',
                    nickname: null,
                    roleTag: null,
                    likesCount: 3,
                  },
                ],
              ],
            ]),
          ),
        create: () => Promise.reject(new Error('not used')),
        findStatusById: () => Promise.resolve(ModerationStatus.APPROVED),
      },
      {
        create: () => Promise.reject(new Error('not used')),
        findApprovedByPostId: () =>
          Promise.resolve({
            items: [
              {
                id: 'comment-1',
                postId: 'post-1',
                parentId: null,
                content: '¡Excelente iniciativa!',
                createdAt: now,
                userAccountId: 'u-other',
                actorId: 'actor-other',
                username: 'Carlos Voluntario',
                rol: 'VOLUNTARIO',
                nickname: null,
                roleTag: null,
                likesCount: 3,
              },
            ],
            total: 1,
          }),
      },
      { toggle: () => Promise.resolve(true) },
    );

    const query = Object.assign(new PaginationQueryDto(), { page: 1, limit: 20 });
    const commentsPage = await service.listApprovedComments('post-1', query);
    expect(commentsPage.data).toHaveLength(1);
    expect(commentsPage.data[0]?.likes_count).toBe(3);
    expect(commentsPage.data[0]?.author.actor_id).toBe('actor-other');

    const session = {
      sessionId: 'sess-1',
      userAccountId: 'u-owner',
      username: 'lucia.acudiente',
      rol: 'ACUDIENTE',
      externalRoles: ['ACUDIENTE'],
      localRole: null,
      nickname: null,
      roleTag: null,
      consentAcceptedAt: now,
      isAccountActive: true,
    };
    const notificationsPage = await service.listNotifications(session, query);
    expect(notificationsPage.data).toHaveLength(1);
    expect(notificationsPage.data[0]?.type).toBe('COMMENT_ON_POST');
    expect(notificationsPage.data[0]?.body).toContain('Carlos Voluntario');

    const readResult = service.markNotificationsRead(session);
    expect(readResult.marked_read).toBe(true);
  });
});
