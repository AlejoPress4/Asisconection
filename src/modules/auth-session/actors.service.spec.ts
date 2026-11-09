import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { SessionContext } from '../../common/auth/interfaces/session-context.interface';
import { ActorsService } from './actors.service';
import { toCurrentSessionDto } from './dto/current-session-response.dto';
import type { Actor } from './entities/actor.entity';
import type { IActorRepository } from './interfaces/i-actor.repository';

function createSampleActor(overrides?: Partial<Actor>): Actor {
  const now = new Date('2026-03-01T12:00:00.000Z');
  return {
    id: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
    userAccountId: 'u1b2c3d4-e5f6-4890-abcd-ef1234567890',
    userAccount: {
      id: 'u1b2c3d4-e5f6-4890-abcd-ef1234567890',
      externalUserId: 10,
      username: 'maria.acudiente',
      email: 'maria@prueba.com',
      rol: 'ACUDIENTE',
      externalRoles: ['ACUDIENTE'],
      localRole: null,
      isActive: true,
      lastSyncedAt: now,
      createdAt: now,
    },
    primaryRole: 'ACUDIENTE',
    firstNames: 'María Fernanda',
    lastNames: 'Gómez',
    avatarUrl: 'https://cdn.asisco.org/maria.jpg',
    shortBio: 'Mamá cuidadora',
    birthDate: '1990-05-14',
    city: 'Manizales',
    showEmail: false,
    showBirthDate: false,
    showCity: false,
    requireFollowApproval: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('ActorsService (Ley 1581 privacy & profile management)', () => {
  const registeredSession: SessionContext = {
    sessionId: 's1b2c3d4-e5f6-4890-abcd-ef1234567890',
    userAccountId: 'u1b2c3d4-e5f6-4890-abcd-ef1234567890',
    username: 'maria.acudiente',
    rol: 'ACUDIENTE',
    externalRoles: ['ACUDIENTE'],
    localRole: null,
    nickname: null,
    roleTag: null,
    consentAcceptedAt: new Date('2026-03-01T12:00:00.000Z'),
    isAccountActive: true,
  };

  let ensureForUserAccountMock: jest.Mock;
  let findByIdMock: jest.Mock;
  let updateByUserAccountIdMock: jest.Mock;
  let createConnectionMock: jest.Mock;
  let service: ActorsService;

  beforeEach(() => {
    ensureForUserAccountMock = jest.fn();
    findByIdMock = jest.fn();
    updateByUserAccountIdMock = jest.fn();
    createConnectionMock = jest.fn();

    const mockRepo: IActorRepository = {
      findByUserAccountId: jest.fn(),
      findById: findByIdMock,
      ensureForUserAccount: ensureForUserAccountMock,
      updateByUserAccountId: updateByUserAccountIdMock,
      getStatsForActor: jest.fn().mockResolvedValue({
        postsCount: 3,
        followersCount: 7,
        followingCount: 4,
      }),
      createConnection: createConnectionMock,
      findConnectionById: jest.fn(),
      updateConnectionStatus: jest.fn(),
      listConnectionsForActor: jest.fn(),
    };
    service = new ActorsService(mockRepo);
  });

  it('returns full personal data and privacy flags to the profile owner on getMyProfile', async () => {
    ensureForUserAccountMock.mockResolvedValue(createSampleActor());

    const result = await service.getMyProfile(registeredSession);

    expect(result.email).toBe('maria@prueba.com');
    expect(result.birth_date).toBe('1990-05-14');
    expect(result.city).toBe('Manizales');
    expect(result.show_email).toBe(false);
    expect(result.show_birth_date).toBe(false);
    expect(result.show_city).toBe(false);
    expect(result.require_follow_approval).toBe(false);
    expect(result.posts_count).toBe(3);
    expect(result.followers_count).toBe(7);
    expect(result.following_count).toBe(4);
  });

  it('hides email, birth_date and city on public getActorById when privacy flags are false (Ley 1581 default)', async () => {
    findByIdMock.mockResolvedValue(
      createSampleActor({
        showEmail: false,
        showBirthDate: false,
        showCity: false,
      }),
    );

    const publicView = await service.getActorById('a1b2c3d4-e5f6-4890-abcd-ef1234567890');

    expect(publicView.email).toBeUndefined();
    expect(publicView.birth_date).toBeUndefined();
    expect(publicView.city).toBeUndefined();
    expect(publicView.show_email).toBeUndefined();
  });

  it('exposes only the personal fields explicitly enabled by the owner on public getActorById', async () => {
    findByIdMock.mockResolvedValue(
      createSampleActor({
        showEmail: false,
        showBirthDate: false,
        showCity: true,
      }),
    );

    const publicView = await service.getActorById('a1b2c3d4-e5f6-4890-abcd-ef1234567890');

    expect(publicView.email).toBeUndefined();
    expect(publicView.birth_date).toBeUndefined();
    expect(publicView.city).toBe('Manizales');
  });

  it('persists privacy toggles and personal fields on updateMyProfile', async () => {
    updateByUserAccountIdMock.mockResolvedValue(
      createSampleActor({
        city: 'Pereira',
        showCity: true,
        requireFollowApproval: true,
      }),
    );

    const updated = await service.updateMyProfile(registeredSession, {
      city: 'Pereira',
      show_city: true,
      require_follow_approval: true,
    });

    expect(updateByUserAccountIdMock).toHaveBeenCalledWith(
      registeredSession.userAccountId,
      'ACUDIENTE',
      expect.objectContaining({
        city: 'Pereira',
        showCity: true,
        requireFollowApproval: true,
      }),
    );
    expect(updated.city).toBe('Pereira');
    expect(updated.show_city).toBe(true);
    expect(updated.require_follow_approval).toBe(true);
  });

  it('rejects anonymous sessions from accessing Actor profiles and prevents self-connections', async () => {
    await expect(
      service.getMyProfile({
        ...registeredSession,
        userAccountId: null,
      }),
    ).rejects.toThrow(ForbiddenException);

    ensureForUserAccountMock.mockResolvedValue(createSampleActor());
    await expect(
      service.createConnection(registeredSession, {
        receiver_actor_id: 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it.each([
    { requireFollowApproval: false, expectedStatus: 'ACCEPTED' },
    { requireFollowApproval: true, expectedStatus: 'PENDING' },
  ])(
    'creates the connection as $expectedStatus when receiver require_follow_approval = $requireFollowApproval',
    async ({ requireFollowApproval, expectedStatus }) => {
      const receiverId = 'b2c3d4e5-f6a7-4890-abcd-ef1234567890';
      ensureForUserAccountMock.mockResolvedValue(createSampleActor());
      findByIdMock.mockResolvedValue(createSampleActor({ id: receiverId, requireFollowApproval }));
      createConnectionMock.mockImplementation(
        (requesterActorId: string, receiverActorId: string, status: string) =>
          Promise.resolve({
            id: 'c3d4e5f6-a7b8-4890-abcd-ef1234567890',
            requesterActorId,
            receiverActorId,
            status,
            requestedAt: new Date('2026-03-01T12:00:00.000Z'),
            acceptedAt: status === 'ACCEPTED' ? new Date('2026-03-01T12:00:00.000Z') : null,
          }),
      );

      const result = await service.createConnection(registeredSession, {
        receiver_actor_id: receiverId,
      });

      expect(createConnectionMock).toHaveBeenCalledWith(
        'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
        receiverId,
        expectedStatus,
      );
      expect(result.status).toBe(expectedStatus);
      expect(result.accepted_at === null).toBe(expectedStatus === 'PENDING');
    },
  );
});

describe('toCurrentSessionDto (GET /v1/sessions/me)', () => {
  const baseSession: SessionContext = {
    sessionId: 's1b2c3d4-e5f6-4890-abcd-ef1234567890',
    userAccountId: 'u1b2c3d4-e5f6-4890-abcd-ef1234567890',
    username: 'mod.global',
    rol: 'VOLUNTARIO',
    externalRoles: ['VOLUNTARIO'],
    localRole: 'MODERATOR',
    nickname: null,
    roleTag: null,
    consentAcceptedAt: new Date('2026-03-01T12:00:00.000Z'),
    isAccountActive: true,
  };

  it('keeps the local MODERATOR role of registered accounts so clients can restore it', () => {
    expect(toCurrentSessionDto(baseSession)).toEqual({
      session_id: baseSession.sessionId,
      is_anonymous: false,
      user_account_id: baseSession.userAccountId,
      display_name: 'mod.global',
      rol: 'VOLUNTARIO',
      external_roles: ['VOLUNTARIO'],
      local_role: 'MODERATOR',
      has_consent: true,
    });
  });

  it('describes anonymous device sessions with nickname and role tag', () => {
    const dto = toCurrentSessionDto({
      ...baseSession,
      userAccountId: null,
      username: null,
      rol: null,
      externalRoles: [],
      localRole: null,
      nickname: 'Visitante Feliz',
      roleTag: 'ACUDIENTE',
    });

    expect(dto.is_anonymous).toBe(true);
    expect(dto.display_name).toBe('Visitante Feliz');
    expect(dto.rol).toBe('ACUDIENTE');
    expect(dto.local_role).toBeNull();
  });
});
