import { randomUUID } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { DeviceSessionJwtPayload } from './interfaces/session-context.interface';

function isDeviceSessionJwtPayload(value: unknown): value is DeviceSessionJwtPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const subValid = typeof record['sub'] === 'string' && record['sub'].length > 0;
  const uidValid = record['uid'] === null || typeof record['uid'] === 'string';
  const roleValid = typeof record['role'] === 'string' && record['role'].length > 0;
  const typValid = record['typ'] === 'device_session';
  return subValid && uidValid && roleValid && typValid;
}

@Injectable()
export class SessionTokenService {
  constructor(private readonly jwtService: JwtService) {}

  sign(payload: DeviceSessionJwtPayload): string {
    return this.jwtService.sign({
      sub: payload.sub,
      uid: payload.uid,
      role: payload.role,
      typ: payload.typ,
      jti: randomUUID(),
    });
  }

  verify(token: string): DeviceSessionJwtPayload {
    let decoded: unknown;
    try {
      decoded = this.jwtService.verify<Record<string, unknown>>(token);
    } catch {
      throw new UnauthorizedException('El token de sesión del dispositivo es inválido o expiró.');
    }

    if (!isDeviceSessionJwtPayload(decoded)) {
      throw new UnauthorizedException('La estructura del token de sesión del dispositivo es inválida.');
    }

    return {
      sub: decoded.sub,
      uid: decoded.uid,
      role: decoded.role,
      typ: 'device_session',
    };
  }
}
