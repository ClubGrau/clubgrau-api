import mongoose, { InferSchemaType, Model } from 'mongoose';

export const EmployeeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: {
    type: String,
    enum: ['ADMIN', 'MANAGER', 'EMPLOYEE'],
    required: true,
  },
  password: { type: String, required: true },
  phone: { type: String, default: null },
  nif: { type: Number },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'VACATION', 'REMOVED'],
    default: 'ACTIVE',
  },
  username: { type: String, default: null },
  gender: { type: String, default: null },
  address: { type: String, default: null },
  languages: { type: String, default: null },
  emergencyContact: { type: String, default: null },
  employmentId: { type: String, default: null },
  jobTitle: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  deactivateAt: { type: Date, default: null },
  removedAt: { type: Date, default: null },
});

/** Campos inferidos do Schema (sem `_id` — é o que `connection.model` tipa). */
export type EmployeeSchemaType = InferSchemaType<typeof EmployeeSchema>;

/** Documento lido do Mongo (lean/hydrated) com `_id`. */
export type EmployeeDocument = EmployeeSchemaType & {
  _id: mongoose.Types.ObjectId;
};

/** Tipo do Model Mongoose — use este no repository/module. */
export type EmployeeMongooseModel = Model<EmployeeSchemaType>;
