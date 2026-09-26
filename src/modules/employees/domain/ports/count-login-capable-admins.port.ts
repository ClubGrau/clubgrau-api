/**
 * Admins who can still log in: `role === ADMIN` and `status` is `ACTIVE` or `VACATION`.
 * Interface only — the count query belongs to the persistence adapter.
 */
export interface CountLoginCapableAdminsPort {
  countLoginCapableAdmins(): Promise<number>;
}
