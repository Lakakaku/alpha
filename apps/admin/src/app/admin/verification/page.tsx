'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@vocilia/ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@vocilia/ui';
import VerificationCyclesList from '@/components/verification/VerificationCyclesList';
import VerificationDatabasesTable from '@/components/verification/VerificationDatabasesTable';
import PaymentInvoicesManager from '@/components/verification/PaymentInvoicesManager';
import { 
  Calendar,
  Database,
  Receipt,
  Activity,
  TrendingUp,
  Users,
  DollarSign
} from 'lucide-react';

interface VerificationCycle {
  id: string;
  week_starting: string;
  week_ending: string;
  status: 'pending' | 'preparing' | 'active' | 'completed' | 'failed';
  total_databases: number;
  prepared_databases: number;
  submitted_databases: number;
  total_transactions: number;
  verified_transactions: number;
  fake_transactions: number;
  total_rewards: number;
  total_invoices: number;
  paid_invoices: number;
  created_at: string;
  prepared_at?: string;
  completed_at?: string;
}

interface VerificationDatabase {
  id: string;
  cycle_id: string;
  store_id: string;
  store_name: string;
  business_name: string;
  transaction_count: number;
  status: 'preparing' | 'ready' | 'downloaded' | 'submitted' | 'processed' | 'expired';
  deadline_at: string;
  prepared_at?: string;
  downloaded_at?: string;
  submitted_at?: string;
  processed_at?: string;
  verification_results?: {
    verified_count: number;
    fake_count: number;
    total_rewards: number;
  };
  file_exports?: {
    csv_url?: string;
    excel_url?: string;
    json_url?: string;
  };
  submitted_file_url?: string;
  created_at: string;
}

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

export default function VerificationPage() {
  const [selectedCycle, setSelectedCycle] = useState<VerificationCycle | null>(null);
  const [selectedDatabase, setSelectedDatabase] = useState<VerificationDatabase | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<PaymentInvoice | null>(null);
  const [activeTab, setActiveTab] = useState('cycles');

  const handleCycleSelect = (cycle: VerificationCycle) => {
    setSelectedCycle(cycle);
    setSelectedDatabase(null);
    setSelectedInvoice(null);
    setActiveTab('databases');
  };

  const handleDatabaseSelect = (database: VerificationDatabase) => {
    setSelectedDatabase(database);
    setSelectedInvoice(null);
  };

  const handleInvoiceSelect = (invoice: PaymentInvoice) => {
    setSelectedInvoice(invoice);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Verification Management</h1>
          <p className="text-gray-600 mt-2">
            Manage weekly verification cycles, database preparation, and payment processing
          </p>
        </div>

        {/* Selected Context */}
        {selectedCycle && (
          <Card className="mb-6 bg-blue-50 border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-blue-900">
                Selected Cycle: Week {formatDate(selectedCycle.week_starting)} - {formatDate(selectedCycle.week_ending)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center">
                  <Database className="w-5 h-5 text-blue-600 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      {selectedCycle.submitted_databases}/{selectedCycle.total_databases}
                    </p>
                    <p className="text-xs text-blue-700">Databases</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <Users className="w-5 h-5 text-blue-600 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      {selectedCycle.verified_transactions.toLocaleString()}
                    </p>
                    <p className="text-xs text-blue-700">Verified</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <DollarSign className="w-5 h-5 text-blue-600 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      {formatCurrency(selectedCycle.total_rewards)}
                    </p>
                    <p className="text-xs text-blue-700">Rewards</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <Receipt className="w-5 h-5 text-blue-600 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      {selectedCycle.paid_invoices}/{selectedCycle.total_invoices}
                    </p>
                    <p className="text-xs text-blue-700">Paid</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Selected Database Context */}
        {selectedDatabase && (
          <Card className="mb-6 bg-green-50 border-green-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-green-900">
                Selected Database: {selectedDatabase.store_name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm font-medium text-green-900">{selectedDatabase.business_name}</p>
                  <p className="text-xs text-green-700">Business</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-green-900">{selectedDatabase.transaction_count}</p>
                  <p className="text-xs text-green-700">Transactions</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-green-900 capitalize">{selectedDatabase.status}</p>
                  <p className="text-xs text-green-700">Status</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-green-900">{formatDate(selectedDatabase.deadline_at)}</p>
                  <p className="text-xs text-green-700">Deadline</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="cycles" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Verification Cycles
            </TabsTrigger>
            <TabsTrigger value="databases" className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              Databases
            </TabsTrigger>
            <TabsTrigger value="invoices" className="flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Payment Invoices
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cycles" className="space-y-6">
            <VerificationCyclesList 
              onCycleSelect={handleCycleSelect}
              selectedCycleId={selectedCycle?.id}
            />
          </TabsContent>

          <TabsContent value="databases" className="space-y-6">
            <VerificationDatabasesTable 
              cycleId={selectedCycle?.id}
              onDatabaseSelect={handleDatabaseSelect}
            />
          </TabsContent>

          <TabsContent value="invoices" className="space-y-6">
            <PaymentInvoicesManager 
              cycleId={selectedCycle?.id}
              onInvoiceSelect={handleInvoiceSelect}
            />
          </TabsContent>
        </Tabs>

        {/* Selected Invoice Details */}
        {selectedInvoice && (
          <Card className="mt-6 bg-purple-50 border-purple-200">
            <CardHeader>
              <CardTitle className="text-lg text-purple-900">
                Invoice Details: {selectedInvoice.store_name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div>
                  <p className="text-sm font-medium text-purple-900">{selectedInvoice.business_name}</p>
                  <p className="text-xs text-purple-700">Business</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-purple-900">{formatCurrency(selectedInvoice.total_amount)}</p>
                  <p className="text-xs text-purple-700">Total Amount</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-purple-900 capitalize">{selectedInvoice.status}</p>
                  <p className="text-xs text-purple-700">Status</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-purple-900">{selectedInvoice.verified_transactions}</p>
                  <p className="text-xs text-purple-700">Verified</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-purple-900">{formatDate(selectedInvoice.due_date)}</p>
                  <p className="text-xs text-purple-700">Due Date</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-purple-900">{selectedInvoice.reminder_count}</p>
                  <p className="text-xs text-purple-700">Reminders</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}