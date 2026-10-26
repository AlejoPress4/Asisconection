export interface ExternalRegisterPayload {
  readonly username: string;
  readonly email: string;
  readonly clave: string;
  readonly rol: string;
}

export interface ExternalAuthUserResult {
  readonly externalUserId: string | null;
  readonly username: string;
  readonly email: string;
  readonly rol: string;
}

export interface IExternalAuthAdapter {
  registerUser(payload: ExternalRegisterPayload): Promise<ExternalAuthUserResult>;
  authenticateUser(identifier: string, clave: string): Promise<ExternalAuthUserResult>;
}

export const EXTERNAL_AUTH_ADAPTER = Symbol('EXTERNAL_AUTH_ADAPTER');

export type RenderRegisterPayload = ExternalRegisterPayload;
export type RenderUserResult = ExternalAuthUserResult;
export type IRenderAuthAdapter = IExternalAuthAdapter;
export const RENDER_AUTH_ADAPTER = EXTERNAL_AUTH_ADAPTER;
