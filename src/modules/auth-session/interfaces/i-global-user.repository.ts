export interface GlobalUserRecord {
  readonly id: string;
  readonly username: string;
  readonly email: string;
  readonly rol: string;
}

export interface IGlobalUserRepository {
  findByUsernameOrEmail(identifier: string): Promise<GlobalUserRecord | null>;
  verifyAdminRole(usernameOrEmail: string): Promise<boolean>;
}

export const GLOBAL_USER_REPOSITORY = Symbol('GLOBAL_USER_REPOSITORY');
