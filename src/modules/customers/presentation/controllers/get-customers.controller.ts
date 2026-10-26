import {
  GetCustomersDto,
  GetCustomersResultDto,
} from '@modules/customers/application/dtos/get-customers.dto';
import { GetCustomersPort } from '@modules/customers/application/ports/inbound/get-customers.port';
import { isRank } from '@modules/customers/domain/rank';
import { InvalidParamError } from '@shared/presentation/errors/invalid-param.error';
import {
  badRequest,
  HttpErrorBody,
  HttpSuccessBody,
  ok,
  serverError,
} from '@shared/presentation/helpers/http-helper';
import { BaseController } from '@shared/presentation/protocols/base-controller';
import { HttpResponse } from '@shared/presentation/protocols/http-response';
import { GetCustomersRequest } from '../http/get-customers.request';

export class GetCustomersController extends BaseController<
  GetCustomersRequest,
  HttpErrorBody | HttpSuccessBody<GetCustomersResultDto>
> {
  constructor(private readonly getCustomers: GetCustomersPort) {
    super();
  }

  async handle(
    request: GetCustomersRequest,
  ): Promise<
    HttpResponse<HttpErrorBody | HttpSuccessBody<GetCustomersResultDto>>
  > {
    try {
      const filters = this.normalizeFilters(request);
      if (filters instanceof Error) {
        return badRequest(filters);
      }

      const result = await this.getCustomers.execute(filters);
      return ok(result);
    } catch (error) {
      return serverError(error as Error);
    }
  }

  private normalizeFilters(
    request: GetCustomersRequest,
  ): GetCustomersDto | InvalidParamError {
    let rank: GetCustomersDto['rank'];
    if (request.rank !== undefined && request.rank !== '') {
      if (!isRank(request.rank)) {
        return new InvalidParamError('rank');
      }
      rank = request.rank;
    }

    const search =
      typeof request.search === 'string' && request.search.trim() !== ''
        ? request.search.trim()
        : undefined;

    return {
      rank,
      search,
      page: request.page,
      limit: request.limit,
    };
  }
}
