/** Driven port: implemented by `auth`. Answers only whether the password matches a login-capable actor. */
export interface VerifyActorPasswordPort {
  verify(actorId: string, password: string): Promise<boolean>;
}
