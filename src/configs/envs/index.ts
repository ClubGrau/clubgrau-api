export default {
  mongoUri: process.env.DATABASE_HOST,
  port: process.env.PORT || 3003,
  jwtSecret: process.env.JWT_SECRET,
  tokenExpirationTime: process.env.TOKEN_EXPIRATION_TIME,
  resendApiKey: process.env.RESEND_API_KEY,
  resendFrom: process.env.RESEND_FROM, // TODO - add default email vcalue from config
  passwordResetPepper: process.env.PASSWORD_RESET_PEPPER,
  frontendPublicOrigin: process.env.FRONTEND_PUBLIC_ORIGIN,
  /** Public base URL of this API (e.g. https://api.example.com). Used by keep-alive ping. */
  appPublicUrl: process.env.APP_PUBLIC_URL,
  /** When true, schedules GET /health/liveness every 14 minutes to avoid host hibernation. */
  keepAliveEnabled: process.env.KEEP_ALIVE_ENABLED === 'true',
};
