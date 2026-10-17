import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Download,
  RefreshCw,
  Receipt,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import toast from 'react-hot-toast';
import PageHeader from '../../../components/ui/PageHeader';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import StatusBadge from '../../../components/ui/StatusBadge';
import Pagination from '../../../components/ui/Pagination';
import { EmptyState, ErrorState } from '../../../components/ui/StateViews';
import { PageLoader } from '../../../components/ui/LoadingSpinner';
import ReportsNavTabs from './ReportsNavTabs';
import { getOutstandingReport } from '../../../api/reportsApi';
import { getBuildings } from '../../../api/buildingsApi';
import { formatCurrency } from '../../../utils/currency';
import { formatDate } from '../../../utils/date';
import { downloadCsv } from '../../../utils/csv';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Unpaid Dues' },
  { value: 'overdue', label: 'Overdue Invoices Only' },
  { value: 'pending', label: 'Current Pending Only' },
];

export default function OutstandingReportPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [buildingId, setBuildingId] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [buildings, setBuildings] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    let isMounted = true;
    getBuildings({ limit: 100 })
      .then((res) => {
        if (!isMounted) return;
        const list = res?.items ?? (Array.isArray(res) ? res : []);
        setBuildings(list);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const fetchReport = useCallback(async () => {
    if (startDate && endDate && startDate > endDate) {
      toast.error('Start date cannot be after end date');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getOutstandingReport({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        buildingId: buildingId !== 'all' ? buildingId : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setReport(data);
      setPage(1);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to load outstanding report';
      setError(msg);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, buildingId, statusFilter]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportCsv = () => {
    if (!report?.items || report.items.length === 0) {
      toast.error('No outstanding records to export');
      return;
    }

    const headers = [
      { key: 'flat', label: 'Flat Number' },
      { key: 'resident', label: 'Resident Name' },
      { key: 'building', label: 'Building' },
      { key: 'bill', label: 'Bill Number' },
      { key: 'period', label: 'Billing Period' },
      { key: 'amount', label: 'Outstanding Amount (INR)' },
      { key: 'dueDate', label: 'Due Date' },
      { key: 'status', label: 'Status' },
    ];

    const rows = report.items.map((b) => ({
      flat: b.flatNumber || b.flat?.flatNumber || '—',
      resident: b.residentName || b.resident?.name || b.user?.name || 'Resident',
      building: b.buildingName || b.flat?.building?.name || '—',
      bill: b.billNumber || b.id || 'N/A',
      period: b.billingPeriod || b.month || 'Current',
      amount: b.amount || b.totalAmount || 0,
      dueDate: formatDate(b.dueDate),
      status: b.isOverdue || b.status === 'overdue' ? 'Overdue' : 'Unpaid',
    }));

    downloadCsv(`outstanding-report-${new Date().toISOString().slice(0, 10)}`, headers, rows);
    toast.success('Outstanding report exported to CSV');
  };

  const buildingOptions = [
    { value: 'all', label: 'All Buildings' },
    ...buildings.map((b) => ({
      value: String(b._id || b.id),
      label: b.name || b.buildingName || 'Building',
    })),
  ];

  const tableItems = report?.items || [];
  const totalPages = Math.ceil(tableItems.length / pageSize) || 1;
  const pagedRecords = tableItems.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Outstanding Balance Reports"
        subtitle="Comprehensive review of receivables, overdue accounts, and outstanding balances by building"
        icon={<TrendingUp size={22} />}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchReport}
              disabled={loading}
              title="Refresh report"
            >
              <RefreshCw size={16} />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportCsv}
              disabled={loading || !report?.items || report.items.length === 0}
              iconLeft={Download}
            >
              Export CSV
            </Button>
          </div>
        }
      />

      <ReportsNavTabs />

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-44">
          <Input
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="w-full sm:w-44">
          <Input
            label="End Date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="w-full sm:w-48">
          <Select
            label="Building"
            options={buildingOptions}
            value={buildingId}
            onChange={(e) => setBuildingId(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="w-full sm:w-48">
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="flex items-center gap-2 pb-0.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setBuildingId('all');
              setStatusFilter('all');
            }}
            disabled={
              loading ||
              (!startDate && !endDate && buildingId === 'all' && statusFilter === 'all')
            }
          >
            Reset
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-16 flex justify-center bg-white rounded-xl border border-slate-200 shadow-sm">
          <PageLoader />
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <ErrorState
            title="Failed to load outstanding balance report"
            description={error}
            onRetry={fetchReport}
          />
        </div>
      ) : report ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Receipt size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Total Outstanding</p>
                <p className="text-2xl font-bold text-amber-700 mt-0.5">
                  {formatCurrency(report.totalOutstanding)}
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <Clock size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Unpaid Invoices</p>
                <p className="text-2xl font-bold text-slate-900 mt-0.5">
                  {report.outstandingBillsCount}
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-rose-200 bg-rose-50/20 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <p className="text-xs text-rose-800 font-medium">Overdue Amount</p>
                <p className="text-2xl font-bold text-rose-700 mt-0.5">
                  {formatCurrency(report.overdueAmount)}
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Overdue Invoices</p>
                <p className="text-2xl font-bold text-rose-600 mt-0.5">
                  {report.overdueCount}
                </p>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          {(report.outstandingByBuilding?.length > 0 || report.outstandingByPeriod?.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {report.outstandingByBuilding?.length > 0 && (
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-800 mb-1">
                    Outstanding by Building
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Receivables breakdown across properties
                  </p>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={report.outstandingByBuilding}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="buildingName" tick={{ fontSize: 12, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                        <Tooltip
                          formatter={(val) => [formatCurrency(val), 'Outstanding']}
                          contentStyle={{
                            backgroundColor: '#ffffff',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            fontSize: '12px',
                          }}
                        />
                        <Bar dataKey="amount" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {report.outstandingByPeriod?.length > 0 && (
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-800 mb-1">
                    Outstanding by Billing Period
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Unpaid totals across monthly cycles
                  </p>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={report.outstandingByPeriod}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="period" tick={{ fontSize: 12, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                        <Tooltip
                          formatter={(val) => [formatCurrency(val), 'Outstanding']}
                          contentStyle={{
                            backgroundColor: '#ffffff',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            fontSize: '12px',
                          }}
                        />
                        <Bar dataKey="amount" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Detailed Invoices Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  Unpaid Invoices Ledger
                </h3>
                <p className="text-xs text-slate-400">
                  {tableItems.length} record{tableItems.length !== 1 ? 's' : ''} awaiting settlement
                </p>
              </div>
            </div>

            {tableItems.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={Receipt}
                  title="No outstanding dues found"
                  description="All bills in the selected scope are paid, or no matching records exist."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Flat & Resident</th>
                      <th className="py-3 px-4">Bill Reference</th>
                      <th className="py-3 px-4">Period</th>
                      <th className="py-3 px-4">Amount Due</th>
                      <th className="py-3 px-4">Due Date</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {pagedRecords.map((b) => {
                      const id = b.id || b._id;
                      const resName =
                        b.residentName ||
                        b.resident?.name ||
                        b.user?.name ||
                        'Resident';
                      const flatNo =
                        b.flatNumber ||
                        b.flat?.flatNumber ||
                        '—';
                      const bName =
                        b.buildingName ||
                        b.flat?.building?.name ||
                        '';
                      const isOverdue =
                        b.isOverdue ||
                        b.status === 'overdue' ||
                        (b.dueDate && new Date(b.dueDate) < new Date());

                      return (
                        <tr key={id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-800 block">
                              Flat {flatNo}
                            </span>
                            <span className="text-xs text-slate-500">
                              {resName} {bName ? `· ${bName}` : ''}
                            </span>
                          </td>

                          <td className="py-3 px-4 font-mono text-xs text-slate-700">
                            {b.billNumber || b.id || 'N/A'}
                          </td>

                          <td className="py-3 px-4 text-slate-600">
                            {b.billingPeriod || b.month || 'Current'}
                          </td>

                          <td className="py-3 px-4 font-bold text-slate-900">
                            {formatCurrency(b.amount || b.totalAmount)}
                          </td>

                          <td className="py-3 px-4 text-xs text-slate-500">
                            {formatDate(b.dueDate)}
                          </td>

                          <td className="py-3 px-4">
                            <span
                              className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                                isOverdue
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {isOverdue ? 'Overdue' : 'Unpaid'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-200">
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  totalItems={tableItems.length}
                  pageSize={pageSize}
                  onPageChange={setPage}
                />
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
