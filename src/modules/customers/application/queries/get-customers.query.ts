import {
  normalizePagination,
  toPaginatedResult,
} from '@shared/application/pagination/pagination.dto';
import {
  FindCustomersItem,
  GetCustomersDto,
  GetCustomersIndicationDto,
  GetCustomersItemDto,
  GetCustomersResultDto,
  NameByIdReadModel,
} from '../dtos/get-customers.dto';
import { GetCustomersPort } from '../ports/inbound/get-customers.port';
import { FindCustomerNamesByIdsPort } from '../ports/outbound/find-customer-names-by-ids.port';
import { FindCustomersPort } from '../ports/outbound/find-customers.port';
import { FindIndicationOriginNamesByIdsPort } from '../ports/outbound/find-indication-origin-names-by-ids.port';

type NamesById = Map<string, string>;

export class GetCustomersQuery implements GetCustomersPort {
  constructor(
    private readonly findCustomers: FindCustomersPort,
    private readonly findOriginNames: FindIndicationOriginNamesByIdsPort,
    private readonly findCustomerNames: FindCustomerNamesByIdsPort,
  ) {}

  async execute(filters: GetCustomersDto): Promise<GetCustomersResultDto> {
    const pagination = normalizePagination(filters);
    const search = filters.search?.trim() || undefined;

    const { items, total } = await this.findCustomers.findAll({
      rank: filters.rank,
      search,
      skip: pagination.skip,
      limit: pagination.limit,
    });

    const [originNames, referrerNames] = await Promise.all([
      this.loadNames(this.collectOriginIds(items), (ids) =>
        this.findOriginNames.findOriginNamesByIds(ids),
      ),
      this.loadNames(this.collectReferrerIds(items), (ids) =>
        this.findCustomerNames.findNamesByIds(ids),
      ),
    ]);

    const customers = items.map((item) =>
      this.toItem(item, originNames, referrerNames),
    );

    const {
      page,
      limit,
      total: totalItems,
      totalPages,
    } = toPaginatedResult(customers, total, pagination);

    return {
      customers,
      page,
      limit,
      total: totalItems,
      totalPages,
    };
  }

  private collectOriginIds(items: FindCustomersItem[]): string[] {
    const ids = new Set<string>();
    for (const { indication } of items) {
      if (indication !== null && indication.categoryId !== 'amigo') {
        ids.add(indication.originId);
      }
    }
    return [...ids];
  }

  private collectReferrerIds(items: FindCustomersItem[]): string[] {
    const ids = new Set<string>();
    for (const { indication } of items) {
      if (indication !== null && indication.categoryId === 'amigo') {
        ids.add(indication.referrerCustomerId);
      }
    }
    return [...ids];
  }

  private async loadNames(
    ids: string[],
    load: (ids: string[]) => Promise<NameByIdReadModel[]>,
  ): Promise<NamesById> {
    if (ids.length === 0) {
      return new Map();
    }

    const rows = await load(ids);
    return new Map(rows.map(({ id, name }) => [id, name]));
  }

  private toItem(
    item: FindCustomersItem,
    originNames: NamesById,
    referrerNames: NamesById,
  ): GetCustomersItemDto {
    return {
      ...item,
      indication: this.toIndication(
        item.indication,
        originNames,
        referrerNames,
      ),
    };
  }

  private toIndication(
    indication: FindCustomersItem['indication'],
    originNames: NamesById,
    referrerNames: NamesById,
  ): GetCustomersIndicationDto | null {
    if (indication === null) {
      return null;
    }

    if (indication.categoryId === 'amigo') {
      return {
        categoryId: 'amigo',
        referrerCustomerId: indication.referrerCustomerId,
        name: referrerNames.get(indication.referrerCustomerId) ?? null,
      };
    }

    return {
      categoryId: indication.categoryId,
      originId: indication.originId,
      name: originNames.get(indication.originId) ?? null,
    };
  }
}
