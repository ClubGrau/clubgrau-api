export const makeChainableMock = <T>(returnValue?: T) => ({
  countDocuments: jest.fn().mockReturnValue(returnValue),
  findOne: jest.fn().mockReturnThis(),
  findById: jest.fn().mockReturnThis(),
  find: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  create: jest.fn().mockReturnValue(returnValue),
  updateOne: jest.fn().mockResolvedValue({ matchedCount: 1 }),
  lean: jest.fn().mockReturnValue(returnValue),
});
