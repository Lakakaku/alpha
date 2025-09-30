'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@vocilia/ui';
import { Button } from '@vocilia/ui';
import { Badge } from '@vocilia/ui';
import { Input } from '@vocilia/ui';
import { 
  DollarSign,
  Calendar,
  Store,
  AlertCircle,
  CheckCircle,
  Clock,
  CreditCard,
  Receipt,
  Mail,
  Search,
  Filter,
  RefreshCw,
  Download,
  Eye,
  Send
} from 'lucide-react';

interface PaymentInvoice {
  id: string;
  cycle_id: string;
  database_id: string;
  store_id: string;
  store_name: string;
  business_name: string;
  business_email: string;
  status: 'pending' | 'sent' | 'overdue' | 'paid' | 'failed' | 'disputed';
  reward_amount: number;
  admin_fee: number;
  total_amount: number;
  verified_transactions: number;
  fake_transactions: number;
  verification_rate: number;
  invoice_date: string;
  due_date: string;
  paid_date?: string;
  payment_reference?: string;
  payment_method?: string;
  reminder_count: number;
  last_reminder_sent?: string;
  dispute_reason?: string;
  created_at: string;
  updated_at: string;
}

interface PaymentInvoicesManagerProps {
  cycleId?: string;
  onInvoiceSelect?: (invoice: PaymentInvoice) => void;
}

export default function PaymentInvoicesManager({ cycleId, onInvoiceSelect }: PaymentInvoicesManagerProps) {
  const [invoices, setInvoices] = useState<PaymentInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [processingInvoice, setProcessingInvoice] = useState<string | null>(null);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoices();
  }, [cycleId]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const url = cycleId 
        ? `/api/admin/verification/cycles/${cycleId}/invoices`
        : '/api/admin/verification/invoices';
        
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch payment invoices');
      }

      const data = await response.json();
      setInvoices(data.invoices || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async (invoiceId: string) => {
    try {
      setProcessingInvoice(invoiceId);
      const response = await fetch(`/api/admin/verification/invoices/${invoiceId}/payment`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'paid',
          payment_method: 'manual',
          payment_reference: `ADM-${Date.now()}`
        })
      });

      if (!response.ok) {
        throw new Error('Failed to mark invoice as paid');
      }

      await fetchInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark as paid');
    } finally {
      setProcessingInvoice(null);
    }
  };

  const handleSendReminder = async (invoiceId: string) => {
    try {
      setSendingReminder(invoiceId);
      const response = await fetch(`/api/admin/verification/invoices/${invoiceId}/reminder`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to send reminder');
      }

      await fetchInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reminder');
    } finally {
      setSendingReminder(null);
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      invoice.store_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: PaymentInvoice['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-700"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'sent':
        return <Badge variant="default" className="bg-blue-100 text-blue-700"><Mail className="w-3 h-3 mr-1" />Sent</Badge>;
      case 'overdue':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Overdue</Badge>;
      case 'paid':
        return <Badge variant="default" className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Paid</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'disputed':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Disputed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getDaysOverdue = (dueDate: string) => {
    const due = new Date(dueDate);
    const now = new Date();
    const diffTime = now.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const getTotalStats = () => {
    const total = filteredInvoices.reduce((acc, inv) => acc + inv.total_amount, 0);
    const paid = filteredInvoices.filter(inv => inv.status === 'paid').reduce((acc, inv) => acc + inv.total_amount, 0);
    const overdue = filteredInvoices.filter(inv => inv.status === 'overdue').reduce((acc, inv) => acc + inv.total_amount, 0);
    const pending = filteredInvoices.filter(inv => ['pending', 'sent'].includes(inv.status)).reduce((acc, inv) => acc + inv.total_amount, 0);

    return { total, paid, overdue, pending };
  };

  const stats = getTotalStats();

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          Loading payment invoices...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-600 mb-2">{error}</p>
            <Button onClick={fetchInvoices} variant="outline" size="sm">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Payment Invoices</h2>
          <p className="text-gray-600">
            {cycleId ? 'Invoices for this verification cycle' : 'All payment invoices across cycles'}
          </p>
        </div>
        <Button onClick={fetchInvoices} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Payment Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Receipt className="w-8 h-8 text-blue-500 mr-3" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.total)}</p>
                <p className="text-sm text-gray-600">Total Amount</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <CheckCircle className="w-8 h-8 text-green-500 mr-3" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.paid)}</p>
                <p className="text-sm text-gray-600">Paid</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Clock className="w-8 h-8 text-orange-500 mr-3" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.pending)}</p>
                <p className="text-sm text-gray-600">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <AlertCircle className="w-8 h-8 text-red-500 mr-3" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.overdue)}</p>
                <p className="text-sm text-gray-600">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by store name, business, or invoice ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="overdue">Overdue</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="disputed">Disputed</option>
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Invoices ({filteredInvoices.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-8">
              <Receipt className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No payment invoices found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Business</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Amount</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Verification</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Due Date</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((invoice) => {
                    const daysOverdue = getDaysOverdue(invoice.due_date);
                    
                    return (
                      <tr 
                        key={invoice.id} 
                        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => onInvoiceSelect?.(invoice)}
                      >
                        <td className="py-4 px-4">
                          <div>
                            <p className="font-medium text-gray-900">{invoice.store_name}</p>
                            <p className="text-sm text-gray-600">{invoice.business_name}</p>
                            <p className="text-xs text-gray-500">{invoice.business_email}</p>
                          </div>
                        </td>
                        
                        <td className="py-4 px-4">
                          <div className="space-y-1">
                            {getStatusBadge(invoice.status)}
                            {invoice.status === 'overdue' && daysOverdue > 0 && (
                              <p className="text-xs text-red-600">{daysOverdue} days overdue</p>
                            )}
                            {invoice.reminder_count > 0 && (
                              <p className="text-xs text-gray-500">{invoice.reminder_count} reminder(s) sent</p>
                            )}
                          </div>
                        </td>
                        
                        <td className="py-4 px-4">
                          <div>
                            <p className="font-medium text-gray-900">{formatCurrency(invoice.total_amount)}</p>
                            <div className="text-sm text-gray-600">
                              <p>Rewards: {formatCurrency(invoice.reward_amount)}</p>
                              <p>Fee: {formatCurrency(invoice.admin_fee)}</p>
                            </div>
                          </div>
                        </td>
                        
                        <td className="py-4 px-4">
                          <div className="text-sm">
                            <p className="text-green-600">{invoice.verified_transactions} verified</p>
                            {invoice.fake_transactions > 0 && (
                              <p className="text-red-600">{invoice.fake_transactions} fake</p>
                            )}
                            <p className="text-gray-600">{Math.round(invoice.verification_rate * 100)}% rate</p>
                          </div>
                        </td>
                        
                        <td className="py-4 px-4">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                            <div>
                              <p className="text-sm">{formatDate(invoice.due_date)}</p>
                              {invoice.paid_date && (
                                <p className="text-xs text-green-600">Paid: {formatDate(invoice.paid_date)}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            {(invoice.status === 'pending' || invoice.status === 'sent' || invoice.status === 'overdue') && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMarkAsPaid(invoice.id);
                                  }}
                                  disabled={processingInvoice === invoice.id}
                                >
                                  {processingInvoice === invoice.id ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      <CreditCard className="w-4 h-4 mr-1" />
                                      Mark Paid
                                    </>
                                  )}
                                </Button>

                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSendReminder(invoice.id);
                                  }}
                                  disabled={sendingReminder === invoice.id}
                                >
                                  {sendingReminder === invoice.id ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Send className="w-4 h-4" />
                                  )}
                                </Button>
                              </>
                            )}

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Generate invoice PDF or download
                                window.open(`/api/admin/verification/invoices/${invoice.id}/download`, '_blank');
                              }}
                              title="Download Invoice"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                onInvoiceSelect?.(invoice);
                              }}
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}