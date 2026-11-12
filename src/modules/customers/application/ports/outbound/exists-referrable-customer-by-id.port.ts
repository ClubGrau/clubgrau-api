export interface ExistsReferrableCustomerByIdPort {
  existsReferrableById(id: string): Promise<boolean>;
}
