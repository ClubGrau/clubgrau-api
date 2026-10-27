import mongoose from 'mongoose';
import { FindCustomersItem } from '@modules/customers/application/dtos/get-customers.dto';
import { CustomerModel } from '@modules/customers/domain/models/customer.model';
import { IndicationSnapshot } from '@modules/customers/domain/value-objects/indication.vo';
import { CustomerDocument } from './customer.schema';

function mapIndicationFromDocument(
  indication: CustomerDocument['indication'],
): IndicationSnapshot | null {
  if (indication == null) {
    return null;
  }

  if (indication.categoryId === 'amigo') {
    return {
      categoryId: 'amigo',
      referrerCustomerId: String(indication.referrerCustomerId),
    };
  }

  return {
    categoryId: indication.categoryId,
    originId: String(indication.originId),
  };
}

function mapIndicationToDocument(
  indication: IndicationSnapshot,
): NonNullable<CustomerDocument['indication']> {
  if (indication.categoryId === 'amigo') {
    return {
      categoryId: 'amigo',
      referrerCustomerId: new mongoose.Types.ObjectId(
        indication.referrerCustomerId,
      ),
    };
  }

  return {
    categoryId: indication.categoryId,
    originId: new mongoose.Types.ObjectId(indication.originId),
  };
}

/** Maps a lean Mongoose document to the GetCustomers read row (ids only). */
export function mapCustomerReadModel(
  document: CustomerDocument,
): FindCustomersItem {
  return {
    id: String(document._id),
    name: document.name,
    email: document.email,
    phone: document.phone ?? null,
    nif: document.nif != null ? String(document.nif) : null,
    createdAt: document.createdAt ?? new Date(0),
    rank: document.rank,
    indication: mapIndicationFromDocument(document.indication),
  };
}

/** Maps a lean Mongoose document to the application persistence DTO. */
export function mapCustomerDocument(
  document: CustomerDocument,
): CustomerModel.toCreate {
  return {
    id: String(document._id),
    name: document.name,
    email: document.email,
    phone: document.phone ?? null,
    nif: document.nif != null ? String(document.nif) : null,
    createdAt: document.createdAt ?? new Date(0),
    rank: document.rank,
    indication: mapIndicationFromDocument(document.indication),
  };
}

/** Maps the application DTO to the Mongoose persistence payload. */
export function mapToCreateDocument(
  customer: CustomerModel.toCreate,
): CustomerDocument {
  const { id, nif, indication, ...rest } = customer;

  const document: Record<string, unknown> = {
    ...rest,
    _id: new mongoose.Types.ObjectId(id),
    nif: nif ? Number(nif) : null,
  };

  if (indication !== null) {
    document.indication = mapIndicationToDocument(indication);
  }

  return document as CustomerDocument;
}
