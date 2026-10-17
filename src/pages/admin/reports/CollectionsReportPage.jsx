import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Download,
  RefreshCw,
  CreditCard,
  CheckCircle2,
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
import { getCollectionsReport } from '../../../api/reportsApi';
import { getBuildings } from '../../../api/buildingsApi';
import { formatCurrency } from '../../../utils/currency';
import { formatDate } from '../../../utils/date';
import { downloadCsv } from '../../../utils/csv';

export default function CollectionsReportPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [buildingId, setBuildingId] = useState('all');

  const [buildings, setBuildings] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination for records table
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Load buildings list for filter
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
      const data = await getCollectionsReport({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        buildingId: buildingId !== 'all' ? buildingId : undefined,
      });
      setReport(data);
      setPage(1);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to load collections report';
      setError(msg);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, buildingId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportCsv = () => {
    if (!report?.items || report.items.length === 0) {
      toast.error('No collection records to export');
      return;
    }

    const headers = [
      { key: 'resident', label: 'Resident Name' },
      { key: 'flat', label: 'Flat Number' },
      { key: 'building', label: 'Building' },
      { key: 'bill', label: 'Bill Reference' },
      { key: 'amount', label: 'Amount (INR)' },
      { key: 'method', label: 'Payment Method' },
      { key: 'reference', label: 'Transaction Reference' },
      { key: 'date', label: 'Payment Date' },
      { key: 'status', label: 'Verification Status' },
    ];

    const rows = report.items.map((p) => ({
      resident: p.residentName || p.resident?.name || p.user?.name || 'Resident',
      flat: p.flatNumber || p.flat?.flatNumber || '—',
      building: p.buildingName || p.flat?.building?.name || '—',
      bill: p.billNumber || p.billId || 'Direct Payment',
      amount: p.amount,
      method: p.paymentMethod || 'Manual',
      reference: p.referenceNumber || p.transactionId || '—',
      date: formatDate(p.paymentDate || p.createdAt),
      status: p.status || 'verified',
    }));

    downloadCsv(`collections-report-${new Date().toISOString().slice(0, 10)}`, headers, rows);
    toast.success('Collections report exported to CSV');
  };

  const buildingOptions = [
    { value: 'all', label: 'All Buildings' },
    ...buildings.map((b) => ({
      value: String(b._id || b.id),
      label: b.name || b.buildingName || 'Building',
    })),
  ];

  // Paged slice for table
  const tableItems = report?.items || [];
  const totalPages = Math.ceil(tableItems.length / pageSize) || 1;
  const pagedRecords = tableItems.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Collection Reports"
        subtitle="Audited breakdown of maintenance receipts, verified payments, and historical collection trends"
        icon={<BarChart3 size={22} />}
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

        <div className="w-full sm:w-52">
          <Select
            label="Building"
            options={buildingOptions}
            value={buildingId}
            onChange={(e) => setBuildingId(e.target.value)}
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
            }}
            disabled={loading || (!startDate && !endDate && buildingId === 'all')}
          >
            Reset
          </Button>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="py-16 flex justify-center bg-white rounded-xl border border-slate-200 shadow-sm">
          <PageLoader />
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <ErrorState
            title="Failed to generate collections report"
            description={error}
            onRetry={fetchReport}
          />
        </div>
      ) : report ? (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CreditCard size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Total Verified Collections</p>
                <p className="text-2xl font-bold text-slate-900 mt-0.5">
                  {formatCurrency(report.totalCollected)}
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Verified Receipts</p>
                <p className="text-2xl font-bold text-slate-900 mt-0.5">
                  {report.verifiedCount}
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Clock size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Pending Verifications</p>
                <p className="text-2xl font-bold text-amber-600 mt-0.5">
                  {report.pendingCount}
                </p>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          {(report.collectionsByPeriod?.length > 0 || report.collectionsByBuilding?.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {report.collectionsByPeriod?.length > 0 && (
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-800 mb-1">
                    Collections by Billing Period
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Aggregated verified collections over time
                  </p>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={report.collectionsByPeriod}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="period" tick={{ fontSize: 12, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                        <Tooltip
                          formatter={(val) => [formatCurrency(val), 'Collected']}
                          contentStyle={{
                            backgroundColor: '#ffffff',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            fontSize: '12px',
                          }}
                        />
                        <Bar dataKey="amount" fill="#0284c7" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {report.collectionsByBuilding?.length > 0 && (
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-800 mb-1">
                    Collections by Building
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Distribution of fees collected across properties
                  </p>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={report.collectionsByBuilding}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="buildingName" tick={{ fontSize: 12, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                        <Tooltip
                          formatter={(val) => [formatCurrency(val), 'Collected']}
                          contentStyle={{
                            backgroundColor: '#ffffff',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            fontSize: '12px',
                          }}
                        />
                        <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Records Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  Verified Payment Ledger
                </h3>
                <p className="text-xs text-slate-400">
                  {tableItems.length} verified transaction{tableItems.length !== 1 ? 's' : ''} in selected period
                </p>
              </div>
            </div>

            {tableItems.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={CreditCard}
                  title="No collections recorded"
                  description="No verified payments match the selected date range or building filter."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Resident & Flat</th>
                      <th className="py-3 px-4">Bill Reference</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Method</th>
                      <th className="py-3 px-4">Transaction Ref</th>
                      <th className="py-3 px-4">Payment Date</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {pagedRecords.map((p) => {
                      const id = p.id || p._id;
                      const resName =
                        p.residentName ||
                        p.resident?.name ||
                        p.user?.name ||
                        'Resident';
                      const flatNo =
                        p.flatNumber ||
                        p.flat?.flatNumber ||
                        '—';
                      const bName =
                        p.buildingName ||
                        p.flat?.building?.name ||
                        '';

                      return (
                        <tr key={id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-800 block">
                              {resName}
                            </span>
                            <span className="text-xs text-slate-400">
                              Flat {flatNo} {bName ? `· ${bName}` : ''}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-slate-700">
                            {p.billNumber || p.billId || 'Direct Payment'}
                          </td>

                          <td className="py-3 px-4 font-bold text-slate-900">
                            {formatCurrency(p.amount)}
                          </td>

                          <td className="py-3 px-4 capitalize text-slate-600">
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 font-medium">
                              {p.paymentMethod?.replace(/_/g, ' ') || 'Manual'}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <code className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
                              {p.referenceNumber || p.transactionId || '—'}
                            </code>
                          </td>

                          <td className="py-3 px-4 text-xs text-slate-500">
                            {formatDate(p.paymentDate || p.createdAt)}
                          </td>

                          <td className="py-3 px-4">
                            <StatusBadge status={p.status || 'verified'} />
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
