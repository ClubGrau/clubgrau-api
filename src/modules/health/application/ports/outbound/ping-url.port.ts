export interface PingUrlPort {
  ping(url: string): Promise<void>;
}
