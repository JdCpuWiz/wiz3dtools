export interface Customer {
  id: number;
  businessName: string | null;
  contactName: string;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateProvince: string | null;
  postalCode: string | null;
  country: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerDto {
  businessName?: string;
  contactName: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  notes?: string;
}

export interface UpdateCustomerDto {
  businessName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  notes?: string;
}
