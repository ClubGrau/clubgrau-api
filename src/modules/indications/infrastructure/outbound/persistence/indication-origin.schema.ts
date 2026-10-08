import mongoose, { InferSchemaType, Model } from 'mongoose';

export const IndicationOriginSchema = new mongoose.Schema(
  {
    categoryId: {
      type: String,
      required: true,
      enum: ['canal', 'campanha'],
    },
    name: { type: String, required: true },
    nameKey: { type: String, required: true },
    position: { type: Number, required: true },
    createdAt: { type: Date, required: true },
    intervals: {
      type: [
        {
          from: { type: Date, required: true },
          to: { type: Date, default: null },
        },
      ],
      required: true,
    },
  },
  { collection: 'origins' },
);

IndicationOriginSchema.index({ categoryId: 1, nameKey: 1 }, { unique: true });

export type IndicationOriginSchemaType = InferSchemaType<
  typeof IndicationOriginSchema
>;

export type IndicationOriginDocument = IndicationOriginSchemaType & {
  _id: mongoose.Types.ObjectId;
};

export type IndicationOriginMongooseModel = Model<IndicationOriginSchemaType>;
