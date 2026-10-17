import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import {
  Megaphone,
  RefreshCw,
  Eye,
  Clock,
  ArrowRight,
  ClipboardList,
} from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import Button from '../../../components/ui/Button';
import SearchInput from '../../../components/ui/SearchInput';
import Modal from '../../../components/ui/Modal';
import Pagination from '../../../components/ui/Pagination';
import { EmptyState, ErrorState } from '../../../components/ui/StateViews';
import { PageLoader } from '../../../components/ui/LoadingSpinner';
import {
  getAnnouncements,
  getAnnouncementById,
} from '../../../api/announcementsApi';
import { formatDate, formatDateTime } from '../../../utils/date';
import useDebounce from '../../../hooks/useDebounce';

/**
 * Modal to display full announcement text for staff.
 */
function StaffAnnouncementDetailModal({ isOpen, onClose, announcementId }) {
  const [announcement, setAnnouncement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !announcementId) return;
    let isMounted = true;
    setLoading(true);
    setError(null);

    getAnnouncementById(announcementId, 'staff')
      .then((data) => {
        if (isMounted) setAnnouncement(data);
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Failed to load announcement details');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, announcementId]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Staff Bulletin Details" size="lg">
      {loading ? (
        <div className="py-12 flex justify-center">
          <PageLoader />
        </div>
      ) : error ? (
        <div className="py-6">
          <ErrorState
            title="Failed to load announcement"
            description={error}
            onRetry={() => {
              setLoading(true);
              getAnnouncementById(announcementId, 'staff')
                .then(setAnnouncement)
                .catch((e) => setError(e.message))
                .finally(() => setLoading(false));
            }}
          />
        </div>
      ) : announcement ? (
        <div className="space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                  announcement.priority === 'urgent'
                    ? 'bg-rose-100 text-rose-700'
                    : announcement.priority === 'high'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-sky-100 text-sky-700'
                }`}
              >
                {announcement.priority?.toUpperCase() || 'STAFF NOTICE'}
              </span>

              {announcement.expiresAt && (
                <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 flex items-center gap-1">
                  <Clock size={12} />
                  Active until {formatDate(announcement.expiresAt)}
                </span>
              )}
            </div>

            <h2 className="text-xl font-bold text-slate-900 leading-snug">
              {announcement.title}
            </h2>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-2">
              {announcement.author && (
                <span>Posted by: {announcement.author?.name || announcement.author}</span>
              )}
              <span>Posted on {formatDateTime(announcement.createdAt)}</span>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 text-sm whitespace-pre-wrap leading-relaxed">
            {announcement.content || announcement.message || 'No description provided.'}
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

/**
 * Main Staff Announcements Page
 */
export default function StaffAnnouncementsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { id: paramId } = useParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebounce(search, 400);
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const limit = 9;

  const [announcements, setAnnouncements] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [viewId, setViewId] = useState(() => paramId || searchParams.get('id') || null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (page > 1) params.set('page', String(page));
    setSearchParams(params, { replace: true });
  }, [debouncedSearch, page, setSearchParams]);

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAnnouncements(
        { page, limit, search: debouncedSearch, status: 'published' },
        'staff',
      );
      setAnnouncements(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to load announcements';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <PageHeader
        title="Staff Announcements"
        subtitle="Operational bulletins, maintenance schedules, and management notices"
        icon={<Megaphone size={22} />}
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchAnnouncements}
            disabled={loading}
            title="Refresh bulletins"
          >
            <RefreshCw size={16} />
          </Button>
        }
      />

      {/* Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <SearchInput
          placeholder="Search staff notices..."
          value={search}
          onChange={setSearch}
          onClear={() => setSearch('')}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-16 flex justify-center bg-white rounded-xl border border-slate-200 shadow-sm">
          <PageLoader />
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <ErrorState
            title="Failed to load announcements"
            description={error}
            onRetry={fetchAnnouncements}
          />
        </div>
      ) : announcements.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <EmptyState
            icon={Megaphone}
            title={search ? 'No matching bulletins found' : 'No staff announcements'}
            description={
              search
                ? 'Try searching with different keywords.'
                : 'There are currently no staff notices or bulletins posted.'
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {announcements.map((a) => {
              const id = a.id || a._id;
              const isUrgent = a.priority === 'urgent';
              const isHigh = a.priority === 'high';

              return (
                <div
                  key={id}
                  className={`bg-white rounded-xl border shadow-sm p-5 flex flex-col justify-between transition-all hover:shadow-md ${
                    isUrgent
                      ? 'border-rose-300 ring-1 ring-rose-200 bg-rose-50/20'
                      : isHigh
                      ? 'border-amber-300 bg-amber-50/20'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                          isUrgent
                            ? 'bg-rose-100 text-rose-700'
                            : isHigh
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {a.priority || 'Notice'}
                      </span>

                      <span className="text-xs text-slate-400">
                        {formatDate(a.createdAt)}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-800 text-base leading-snug line-clamp-2">
                      {a.title}
                    </h3>

                    <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                      {a.content || a.message || '—'}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      {a.expiresAt ? `Expires: ${formatDate(a.expiresAt)}` : 'Active Notice'}
                    </span>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewId(id)}
                      className="text-sky-600 hover:text-sky-700 hover:bg-sky-50 font-medium"
                      iconRight={ArrowRight}
                    >
                      Read
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <Pagination
                page={page}
                totalPages={totalPages}
                totalItems={total}
                pageSize={limit}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      )}

      {/* Details Modal */}
      <StaffAnnouncementDetailModal
        isOpen={Boolean(viewId)}
        onClose={() => setViewId(null)}
        announcementId={viewId}
      />
    </div>
  );
}
