import { JwtService } from '@nestjs/jwt';
import {
  ANONYMOUS_SESSION_TTL_SECONDS,
  SessionTokenService,
} from '../../src/common/auth/session-token.service';
import {
  generateFriendlyAnonymousNickname,
  resolveAnonymousNickname,
} from '../../src/modules/auth-session/utils/anonymous-nickname.util';

describe('Anonymous session utilities & 24h JWT TTL', () => {
  it('generates warm two-word family-friendly nicknames within 50 chars', () => {
    const samples = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      const name = generateFriendlyAnonymousNickname();
      expect(name.trim().split(/\s+/)).toHaveLength(2);
      expect(name.length).toBeLessThanOrEqual(50);
      samples.add(name);
    }
    expect(samples.size).toBeGreaterThan(5);
  });

  it('replaces empty or generic placeholders with a friendly nickname while preserving custom ones', () => {
    const fromEmpty = resolveAnonymousNickname(undefined);
    const fromGeneric = resolveAnonymousNickname('Invitado');
    const fromCustom = resolveAnonymousNickname('MamáDeMateo');

    expect(fromEmpty.toLowerCase()).not.toBe('invitado');
    expect(fromEmpty.split(' ')).toHaveLength(2);
    expect(fromGeneric.toLowerCase()).not.toBe('invitado');
    expect(fromGeneric.split(' ')).toHaveLength(2);
    expect(fromCustom).toBe('MamáDeMateo');
  });

  it('signs anonymous JWTs with a 24-hour TTL and registered JWTs with the 30-day default', () => {
    const jwtService = new JwtService({
      secret: 'unit_test_secret_key_for_anonymous_ttl_validation_ok',
      signOptions: { expiresIn: '30d' },
    });
    const tokenService = new SessionTokenService(jwtService);

    const anonToken = tokenService.sign({
      sub: '11111111-1111-4111-8111-111111111111',
      uid: null,
      role: 'VISITANTE',
      typ: 'device_session',
    });
    const anonDecoded = jwtService.decode<{ iat: number; exp: number }>(anonToken);
    expect(anonDecoded.exp - anonDecoded.iat).toBe(ANONYMOUS_SESSION_TTL_SECONDS);
    expect(ANONYMOUS_SESSION_TTL_SECONDS).toBe(86400);

    const userToken = tokenService.sign({
      sub: '22222222-2222-4222-8222-222222222222',
      uid: '33333333-3333-4333-8333-333333333333',
      role: 'ACUDIENTE',
      typ: 'device_session',
    });
    const userDecoded = jwtService.decode<{ iat: number; exp: number }>(userToken);
    expect(userDecoded.exp - userDecoded.iat).toBe(30 * 86400);
  });
});
