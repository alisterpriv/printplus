/**
 * Contracts shared between the renderer and the Electron main process.
 * Only the SHAPE of requests/responses crossing the process boundary
 * belongs here — never storage details (e.g. DatabaseSync, SQL, raw
 * table row shapes). See Phase 3 report for the full rule.
 */

export interface SettingsApi {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export interface Rate {
  id: number;
  printType: string;
  rate: number;
  createdAt: string;
  updatedAt: string;
}

export interface RatesApi {
  list(): Promise<Rate[]>;
  update(id: number, rate: number): Promise<void>;
}

export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface CustomersApi {
  list(): Promise<Customer[]>;
  create(input: CustomerInput): Promise<Customer>;
  update(id: number, input: CustomerInput): Promise<void>;
}

export interface PrintPlusApi {
  settings: SettingsApi;
  rates: RatesApi;
  customers: CustomersApi;
}

declare global {
  interface Window {
    api: PrintPlusApi;
  }
}
