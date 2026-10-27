import { Rank } from '@modules/customers/domain/rank';
import { IndicationSnapshot } from '@modules/customers/domain/value-objects/indication.vo';
import { PaginationInputDto } from '@shared/application/pagination/pagination.dto';

/** Input da query GetCustomers (filtros + paginação offset). */
export interface GetCustomersDto extends PaginationInputDto {
  rank?: Rank;
  search?: string;
}

/**
 * Indicação no read model da listagem.
 * `name` é o nome da origem (canal/campanha) ou do customer que indicou (amigo);
 * `null` quando o id gravado não tem linha correspondente.
 */
export type GetCustomersIndicationDto =
  | { categoryId: 'canal' | 'campanha'; originId: string; name: string | null }
  | { categoryId: 'amigo'; referrerCustomerId: string; name: string | null };

/** Read model de um customer na listagem. */
export interface GetCustomersItemDto {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  nif: string | null;
  createdAt: Date;
  rank: Rank;
  indication: GetCustomersIndicationDto | null;
}

/** Params do outbound port de leitura (já com skip/limit normalizados). */
export interface FindCustomersParams {
  rank?: Rank;
  search?: string;
  skip: number;
  limit: number;
}

/** Linha do repositório: a indicação traz só os ids, sem nome. */
export type FindCustomersItem = Omit<GetCustomersItemDto, 'indication'> & {
  indication: IndicationSnapshot | null;
};

/** Resultado bruto do repositório antes da composição dos nomes. */
export interface FindCustomersResult {
  items: FindCustomersItem[];
  total: number;
}

/** Nome resolvido em lote para um id (origem ou customer). */
export interface NameByIdReadModel {
  id: string;
  name: string;
}

/** Output da query GetCustomers (lista nomeada + meta de paginação). */
export interface GetCustomersResultDto {
  customers: GetCustomersItemDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
