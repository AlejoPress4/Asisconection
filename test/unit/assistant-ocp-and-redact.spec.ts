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
});
