export interface ReissueOwnSessionTokenPort {
  execute(actorId: string): Promise<{ token: string }>;
}
