# Reset Token hash is HMAC-SHA256 with a dedicated pepper, not EncrypterPort

Complete looks up the outstanding row by hash of the raw token (`findOne({ tokenHash })`). bcrypt (`EncrypterPort`) is salted and cannot be queried that way; a scan of the collection is unacceptable. The secret is 32 bytes of `crypto.randomBytes`, so a plain SHA-256 preimage is already infeasible. HMAC-SHA256 with `PASSWORD_RESET_PEPPER` still wins if the collection leaks and the env does not. The pepper is **not** `JWT_SECRET`: rotating the session secret must not burn live reset links, and vice versa.
