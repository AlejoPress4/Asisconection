import { NotImplementedException } from '@nestjs/common';
import { redactSensitiveFields } from '../../src/common/utils/redact.util';
import { preserveRawConsentValue } from '../../src/common/utils/strict-boolean.util';
import { validate } from '../../src/config/env.validation';
import { ASSISTANT_DISCLAIMER } from '../../src/modules/assistant/assistant.constants';
import { FaqRuleEngineProvider } from '../../src/modules/assistant/providers/faq-rule-engine.provider';
import { RagMultimodalProviderStub } from '../../src/modules/assistant/providers/rag-multimodal.provider.stub';

describe('Unit — Seguridad Constitucional, Configuración y OCP Assistant', () => {
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

  it('normaliza el alias RENDER_AUTH_API_URL hacia RENDER_API_URL en env.validation', () => {
    const validated = validate({
      DB_LOCAL_URL: 'postgresql://localhost:5432/asisconexion_db',
      DB_GLOBAL_URL: 'postgresql://localhost:5432/foundation_global_db',
      RENDER_AUTH_API_URL: 'https://render-central.example.org',
      USE_MOCK_EXTERNAL_SERVICES: 'false',
      JWT_SECRET: 'secreto_de_pruebas_con_mas_de_32_caracteres_seguros',
      WHATSAPP_SUPPORT_PHONE: '573001234567',
    });

    expect(validated.RENDER_API_URL).toBe('https://render-central.example.org');
    expect(validated.USE_MOCK_EXTERNAL_SERVICES).toBe(false);
    expect(preserveRawConsentValue({ obj: { accept_consent: 'false' } })).toBe('false');
    expect(preserveRawConsentValue({ obj: { accept_consent: true } })).toBe(true);
  });

  it('FaqRuleEngineProvider adjunta siempre ASSISTANT_DISCLAIMER y RagMultimodalProviderStub respeta OCP', async () => {
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

    const ragStub = new RagMultimodalProviderStub();
    expect(() => ragStub.resolveFaqs({ page: 1, limit: 20 })).toThrow(NotImplementedException);
  });
});
