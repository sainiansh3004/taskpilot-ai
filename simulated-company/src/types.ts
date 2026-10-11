export interface Invoice {
  id: string;
  companyName: string;
  invoiceNumber: string;
  issueDate: string; // ISO YYYY-MM-DD
  dueDate: string;   // ISO YYYY-MM-DD
  amount: number;
  currency: string;
  status: 'pending' | 'approved' | 'paid' | 'overdue';
  description: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  missingFields?: string[];
}

export interface InvoiceRecord {
  id: string;
  invoiceId: string;
  companyName: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  dueDate: string;
  createdAt: string;
  status: 'entered' | 'verified' | 'flagged';
  notes?: string;
}

export interface ChaosConfig {
  failMode: 'none' | 'timeout' | '500_error' | 'rate_limit';
  remainingFailures: number;
}
