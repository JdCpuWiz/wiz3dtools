import { CustomerModel } from '../models/customer.model.js';
import type { Customer, CreateCustomerDto, UpdateCustomerDto } from '@wizqueue/shared';

export class CustomerService {
  async getAll(): Promise<Customer[]> {
    return CustomerModel.findAll();
  }

  async getById(id: number): Promise<Customer> {
    const customer = await CustomerModel.findById(id);
    if (!customer) throw new Error('Customer not found');
    return customer;
  }

  async create(data: CreateCustomerDto): Promise<Customer> {
    return CustomerModel.create(data);
  }

  async update(id: number, data: UpdateCustomerDto): Promise<Customer> {
    const customer = await CustomerModel.update(id, data);
    if (!customer) throw new Error('Customer not found');
    return customer;
  }

  async delete(id: number): Promise<void> {
    const deleted = await CustomerModel.delete(id);
    if (!deleted) throw new Error('Customer not found');
  }
}
