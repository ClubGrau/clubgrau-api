import { conflict, forbidden } from './http-helper';

describe('http-helper', () => {
  it('should return 403 with { error } from forbidden', () => {
    const response = forbidden(new Error('nope'));
    expect(response).toEqual({
      statusCode: 403,
      body: { error: 'nope' },
    });
  });

  it('should return 409 with { error } from conflict', () => {
    const response = conflict(new Error('nope'));
    expect(response).toEqual({
      statusCode: 409,
      body: { error: 'nope' },
    });
  });
});
