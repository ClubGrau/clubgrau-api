import mongoose, { InferSchemaType, Model } from 'mongoose';

export const PasswordResetTokenSchema = new mongoose.Schema({
  ownerId: { type: String, required: true, unique: true },
  tokenHash: { type: String, required: true, unique: true },
  issuedAt: { type: Date, required: true },
  // TTL: o Mongo remove o doc quando `expiresAt` é atingido (cleanup apenas).
  // A checagem de expiração da aplicação continua obrigatória (slice 5).
  expiresAt: { type: Date, required: true, expires: 0 },
});

/** Campos inferidos do Schema (sem `_id`). */
export type PasswordResetTokenSchemaType = InferSchemaType<
  typeof PasswordResetTokenSchema
>;

/** Documento lido do Mongo (lean/hydrated) com `_id`. */
export type PasswordResetTokenDocument = PasswordResetTokenSchemaType & {
  _id: mongoose.Types.ObjectId;
};

/** Tipo do Model Mongoose — use este no repository/module. */
export type PasswordResetTokenMongooseModel =
  Model<PasswordResetTokenSchemaType>;
