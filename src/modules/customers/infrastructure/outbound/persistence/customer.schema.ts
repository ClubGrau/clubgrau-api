import mongoose, { InferSchemaType, Model } from 'mongoose';

const IndicationSubSchema = new mongoose.Schema(
  {
    categoryId: {
      type: String,
      enum: ['canal', 'campanha', 'amigo'],
      required: true,
    },
    originId: { type: mongoose.Schema.Types.ObjectId },
    referrerCustomerId: { type: mongoose.Schema.Types.ObjectId },
  },
  { _id: false },
);

export const CustomerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, default: null },
  nif: { type: Number },
  createdAt: { type: Date, default: Date.now },
  rank: {
    type: String,
    enum: ['BRONZE', 'SILVER', 'GOLD'],
    required: true,
  },
  indication: { type: IndicationSubSchema },
});

/** Campos inferidos do Schema (sem `_id` — é o que `connection.model` tipa). */
export type CustomerSchemaType = InferSchemaType<typeof CustomerSchema>;

/** Documento lido do Mongo (lean/hydrated) com `_id`. */
export type CustomerDocument = CustomerSchemaType & {
  _id: mongoose.Types.ObjectId;
};

/** Tipo do Model Mongoose — use este no repository/module. */
export type CustomerMongooseModel = Model<CustomerSchemaType>;
