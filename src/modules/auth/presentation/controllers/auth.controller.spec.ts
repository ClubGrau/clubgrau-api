import { AuthController } from './auth.controller';

const makeSut = () => {
  const sut = new AuthController();
  return {
    sut,
  };
};

describe('AuthController', () => {
  it('should be defined', () => {
    const { sut } = makeSut();
    expect(sut).toBeDefined();
    expect(sut).toBeInstanceOf(AuthController);
  });
});
