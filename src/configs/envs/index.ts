export default {
  mongoUri: process.env.DATABASE_HOST,
  port: process.env.PORT || 3003,
  jwtSecret: process.env.JWT_SECRET,
  tokenExpirationTime: process.env.TOKEN_EXPIRATION_TIME,
  resendApiKey: process.env.RESEND_API_KEY,
  resendFrom: process.env.RESEND_FROM, // TODO - add default email vcalue from config
};
