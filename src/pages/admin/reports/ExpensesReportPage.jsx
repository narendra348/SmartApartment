import { useState, useEffect, useCallback } from 'react';
import {
  PieChart,
  Download,
  RefreshCw,
  Wallet,
  Tag,
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
import Pagination from '../../../components/ui/Pagination';
import { EmptyState, ErrorState } from '../../../components/ui/StateViews';
import { PageLoader } from '../../../components/ui/LoadingSpinner';
import ReportsNavTabs from './ReportsNavTabs';
import { getExpensesReport } from '../../../api/reportsApi';
import { getBuildings } from '../../../api/buildingsApi';
import { formatCurrency } from '../../../utils/currency';
import { formatDate } from '../../../utils/date';
import { downloadCsv } from '../../../utils/csv';

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  { value: 'utilities', label: 'Utilities (Electricity/Water)' },
  { value: 'maintenance', label: 'Repairs & Maintenance' },
  { value: 'staff_salary', label: 'Staff & Security Payroll' },
  { value: 'cleaning', label: 'Housekeeping & Sanitation' },
  { value: 'security', label: 'Security Equipment & Services' },
  { value: 'administrative', label: 'Administrative & Legal' },
  { value: 'other', label: 'Other / Miscellaneous' },
];

export default function ExpensesReportPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [buildingId, setBuildingId] = useState('all');
  const [category, setCategory] = useState('all');

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
      const data = await getExpensesReport({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        buildingId: buildingId !== 'all' ? buildingId : undefined,
        category: category !== 'all' ? category : undefined,
      });
      setReport(data);
      setPage(1);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to load expenses report';
      setError(msg);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, buildingId, category]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportCsv = () => {
    if (!report?.items || report.items.length === 0) {
      toast.error('No expense records to export');
      return;
    }

    const headers = [
      { key: 'category', label: 'Expense Category' },
      { key: 'description', label: 'Description' },
      { key: 'amount', label: 'Amount (INR)' },
      { key: 'date', label: 'Expense Date' },
      { key: 'building', label: 'Building' },
      { key: 'recordedBy', label: 'Recorded By' },
    ];

    const rows = report.items.map((e) => ({
      category: e.category || 'General',
      description: e.description || e.title || '—',
      amount: e.amount || 0,
      date: formatDate(e.date || e.createdAt),
      building: e.buildingName || e.building?.name || 'All Buildings',
      recordedBy: e.recordedBy?.name || e.recordedBy || e.createdBy || 'Admin',
    }));

    downloadCsv(`expenses-report-${new Date().toISOString().slice(0, 10)}`, headers, rows);
    toast.success('Expenses report exported to CSV');
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

  // Determine top category if available
  const topCategory =
    report?.expensesByCategory && report.expensesByCategory.length > 0
      ? [...report.expensesByCategory].sort((a, b) => b.amount - a.amount)[0]?.category
      : '—';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Expense Reports"
        subtitle="Operational expenditures, maintenance costs, and facility spending analysis"
        icon={<PieChart size={22} />}
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

        <div className="w-full sm:w-52">
          <Select
            label="Category"
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
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
              setCategory('all');
            }}
            disabled={
              loading ||
              (!startDate && !endDate && buildingId === 'all' && category === 'all')
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
            title="Failed to load expense report"
            description={error}
            onRetry={fetchReport}
          />
        </div>
      ) : report ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Wallet size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Total Expenses</p>
                <p className="text-2xl font-bold text-slate-900 mt-0.5">
                  {formatCurrency(report.totalExpenses)}
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <Clock size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Expense Entries</p>
                <p className="text-2xl font-bold text-slate-900 mt-0.5">
                  {report.expenseCount}
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <Tag size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Highest Category</p>
                <p className="text-xl font-bold text-slate-800 capitalize mt-0.5 truncate max-w-[180px]">
                  {topCategory}
                </p>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          {(report.expensesByCategory?.length > 0 || report.trends?.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {report.expensesByCategory?.length > 0 && (
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-800 mb-1">
                    Expenses by Category
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Expenditure breakdown across operational heads
                  </p>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={report.expensesByCategory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="category" tick={{ fontSize: 12, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                        <Tooltip
                          formatter={(val) => [formatCurrency(val), 'Expense']}
                          contentStyle={{
                            backgroundColor: '#ffffff',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            fontSize: '12px',
                          }}
                        />
                        <Bar dataKey="amount" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {report.trends?.length > 0 && (
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-800 mb-1">
                    Monthly Expense Trend
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Expenditure progression over time
                  </p>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={report.trends}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="period" tick={{ fontSize: 12, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                        <Tooltip
                          formatter={(val) => [formatCurrency(val), 'Expense']}
                          contentStyle={{
                            backgroundColor: '#ffffff',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            fontSize: '12px',
                          }}
                        />
                        <Bar dataKey="amount" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Detailed Ledger Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  Expense Ledger
                </h3>
                <p className="text-xs text-slate-400">
                  {tableItems.length} expenditure item{tableItems.length !== 1 ? 's' : ''} in selected period
                </p>
              </div>
            </div>

            {tableItems.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={Wallet}
                  title="No expenses found"
                  description="No expenditures recorded match the selected date range, category, or building."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Building</th>
                      <th className="py-3 px-4">Recorded By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {pagedRecords.map((e) => {
                      const id = e.id || e._id;
                      return (
                        <tr key={id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 capitalize font-medium text-slate-800">
                            <span className="text-xs px-2.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                              {e.category || 'General'}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-slate-700 max-w-xs truncate">
                            {e.description || e.title || '—'}
                          </td>

                          <td className="py-3 px-4 font-bold text-slate-900">
                            {formatCurrency(e.amount)}
                          </td>

                          <td className="py-3 px-4 text-xs text-slate-500">
                            {formatDate(e.date || e.createdAt)}
                          </td>

                          <td className="py-3 px-4 text-xs text-slate-600">
                            {e.buildingName || e.building?.name || 'All Buildings'}
                          </td>

                          <td className="py-3 px-4 text-xs text-slate-500">
                            {e.recordedBy?.name || e.recordedBy || e.createdBy || 'Admin'}
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
