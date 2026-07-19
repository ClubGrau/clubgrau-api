export interface CompareHashPort {
  compare(password: string, hash: string): Promise<boolean>;
}
