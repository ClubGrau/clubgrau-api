export interface ExistsCustomerByIdPort {
  existsById(id: string): Promise<boolean>;
}
