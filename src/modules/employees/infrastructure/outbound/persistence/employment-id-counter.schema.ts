import mongoose, { InferSchemaType, Model } from 'mongoose';

export const EmploymentIdCounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, required: true },
});

/** Campos inferidos do Schema (inclui `_id` string). */
export type EmploymentIdCounterSchemaType = InferSchemaType<
  typeof EmploymentIdCounterSchema
>;

/** Tipo do Model Mongoose — use este no adapter. */
export type EmploymentIdCounterModel = Model<EmploymentIdCounterSchemaType>;
