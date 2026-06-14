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
  // BP #19 — true when this customer is a wholesale account
  // (wiz3d-prints User.role === 'wholesaler'). Mirrored from
  // wiz3d-prints' role-change hook; wiz3dtools admin can also flip it
  // directly on the customer edit page. Drives invoice line-item
  // default pricing (wholesale → wholesalePrice; retail → retailPrice).
  isWholesale: boolean;
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
  isWholesale?: boolean;
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
  isWholesale?: boolean;
}
