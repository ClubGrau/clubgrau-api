import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FindIndicationOriginNamesByIdsPort } from '@modules/indications/application/ports/outbound/find-indication-origin-names-by-ids.port';
import { IndicationOriginNamesLookupAdapter } from './indication-origin-names-lookup.adapter';

const ORIGIN_ID = '507f1f77bcf86cd799439011';

const makeSut = () => {
  const findOriginNamesStub = {
    findOriginNamesByIds: jest
      .fn()
      .mockResolvedValue([{ id: ORIGIN_ID, name: 'Instagram' }]),
  } satisfies FindIndicationOriginNamesByIdsPort;

  const sut = new IndicationOriginNamesLookupAdapter(findOriginNamesStub);

  return { sut, findOriginNamesStub };
};

describe('IndicationOriginNamesLookupAdapter', () => {
  it('should forward the ids to the indications port and return the names', async () => {
    const { sut, findOriginNamesStub } = makeSut();

    const result = await sut.findOriginNamesByIds([ORIGIN_ID]);

    expect(findOriginNamesStub.findOriginNamesByIds).toHaveBeenCalledWith([
      ORIGIN_ID,
    ]);
    expect(result).toEqual([{ id: ORIGIN_ID, name: 'Instagram' }]);
  });

  it('should return an empty list when the indications port finds nothing', async () => {
    const { sut, findOriginNamesStub } = makeSut();
    findOriginNamesStub.findOriginNamesByIds.mockResolvedValueOnce([]);

    await expect(sut.findOriginNamesByIds(['missing'])).resolves.toEqual([]);
  });

  it('should not import the customers domain', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'src/modules/indications/infrastructure/outbound/indication-origin-names-lookup.adapter.ts',
      ),
      'utf8',
    );

    expect(source).not.toContain('@modules/customers/domain');
  });
});
