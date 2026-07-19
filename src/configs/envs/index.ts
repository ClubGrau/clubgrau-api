export default {
  mongoUri: process.env.DATABASE_HOST,
  port: process.env.PORT || 3003,
  jwtSecret: process.env.JWT_SECRET,
  tokenExpirationTime: process.env.TOKEN_EXPIRATION_TIME,
};
