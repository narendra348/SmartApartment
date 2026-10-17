import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import {
  Megaphone,
  Plus,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  Send,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../../components/ui/PageHeader';
import Button from '../../../components/ui/Button';
import SearchInput from '../../../components/ui/SearchInput';
import Select from '../../../components/ui/Select';
import Input from '../../../components/ui/Input';
import Textarea from '../../../components/ui/Textarea';
import Modal from '../../../components/ui/Modal';
import ConfirmationDialog from '../../../components/ui/ConfirmationDialog';
import StatusBadge from '../../../components/ui/StatusBadge';
import Pagination from '../../../components/ui/Pagination';
import { EmptyState, ErrorState } from '../../../components/ui/StateViews';
import { PageLoader } from '../../../components/ui/LoadingSpinner';
import {
  getAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  togglePublishAnnouncement,
  deleteAnnouncement,
} from '../../../api/announcementsApi';
import { formatDate, formatDateTime } from '../../../utils/date';
import useDebounce from '../../../hooks/useDebounce';

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
];

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'All Residents & Staff' },
  { value: 'residents', label: 'Residents Only' },
  { value: 'staff', label: 'Staff Only' },
];

const PRIORITY_OPTIONS = [
  { value: 'normal', label: 'Normal Priority' },
  { value: 'high', label: 'High Priority' },
  { value: 'urgent', label: 'Urgent Alert' },
];

const INITIAL_FORM = {
  title: '',
  content: '',
  audience: 'all',
  priority: 'normal',
  expiresAt: '',
  isPublished: true,
};

/**
 * Modal to view full announcement details.
 */
function AnnouncementDetailModal({ isOpen, onClose, announcementId }) {
  const [announcement, setAnnouncement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !announcementId) return;
    let isMounted = true;
    setLoading(true);
    setError(null);

    getAnnouncementById(announcementId, 'admin')
      .then((data) => {
        if (isMounted) setAnnouncement(data);
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Failed to load details');
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
    <Modal isOpen={isOpen} onClose={onClose} title="Announcement Details" size="lg">
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
              getAnnouncementById(announcementId, 'admin')
                .then(setAnnouncement)
                .catch((e) => setError(e.message))
                .finally(() => setLoading(false));
            }}
          />
        </div>
      ) : announcement ? (
        <div className="space-y-5">
          {/* Header & Badges */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                  announcement.priority === 'urgent'
                    ? 'bg-rose-100 text-rose-700'
                    : announcement.priority === 'high'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {announcement.priority?.toUpperCase() || 'NORMAL'}
              </span>

              <StatusBadge
                status={
                  announcement.status ||
                  (announcement.isPublished ? 'published' : 'draft')
                }
              />

              <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 font-medium capitalize">
                Audience: {announcement.audience || 'All'}
              </span>
            </div>

            <h2 className="text-lg font-bold text-slate-900">
              {announcement.title}
            </h2>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
              {announcement.author && (
                <span>By: {announcement.author?.name || announcement.author}</span>
              )}
              <span>Posted: {formatDateTime(announcement.createdAt)}</span>
              {announcement.expiresAt && (
                <span>Expires: {formatDate(announcement.expiresAt)}</span>
              )}
            </div>
          </div>

          {/* Full Content */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 text-sm whitespace-pre-wrap leading-relaxed">
            {announcement.content || announcement.message || 'No content.'}
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
 * Modal to Create or Edit an Announcement.
 */
function AnnouncementFormModal({
  isOpen,
  onClose,
  initialData,
  onSuccess,
}) {
  const isEditing = Boolean(initialData?.id || initialData?._id);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (initialData) {
      setForm({
        title: initialData.title || '',
        content: initialData.content || initialData.message || '',
        audience: initialData.audience || 'all',
        priority: initialData.priority || 'normal',
        expiresAt: initialData.expiresAt ? initialData.expiresAt.slice(0, 10) : '',
        isPublished:
          initialData.isPublished !== undefined
            ? initialData.isPublished
            : initialData.status === 'published',
      });
    } else {
      setForm(INITIAL_FORM);
    }
    setErrors({});
  }, [isOpen, initialData]);

  const validate = () => {
    const errs = {};
    if (!form.title.trim()) {
      errs.title = 'Title is required';
    } else if (form.title.trim().length < 3) {
      errs.title = 'Title must be at least 3 characters';
    }

    if (!form.content.trim()) {
      errs.content = 'Message content is required';
    } else if (form.content.trim().length < 5) {
      errs.content = 'Content must be at least 5 characters';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate() || submitting) return;

    setSubmitting(true);
    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      message: form.content.trim(),
      audience: form.audience,
      priority: form.priority,
      expiresAt: form.expiresAt ? form.expiresAt : null,
      isPublished: form.isPublished,
      status: form.isPublished ? 'published' : 'draft',
    };

    try {
      if (isEditing) {
        const id = initialData.id || initialData._id;
        await updateAnnouncement(id, payload);
        toast.success('Announcement updated successfully!');
      } else {
        await createAnnouncement(payload);
        toast.success('Announcement published successfully!');
      }
      onSuccess();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to save announcement';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={submitting ? () => {} : onClose}
      title={isEditing ? 'Edit Announcement' : 'Create New Announcement'}
      size="lg"
      closeOnBackdrop={!submitting}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Announcement Title"
          required
          placeholder="e.g. Scheduled Elevator Maintenance on Friday"
          value={form.title}
          onChange={(e) => {
            setForm((prev) => ({ ...prev, title: e.target.value }));
            if (errors.title) setErrors((prev) => ({ ...prev, title: null }));
          }}
          error={errors.title}
          disabled={submitting}
        />

        <Textarea
          label="Message Content"
          required
          rows={5}
          placeholder="Describe the notice in detail. This will be visible to all recipients in their portal."
          value={form.content}
          onChange={(e) => {
            setForm((prev) => ({ ...prev, content: e.target.value }));
            if (errors.content) setErrors((prev) => ({ ...prev, content: null }));
          }}
          error={errors.content}
          disabled={submitting}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            label="Target Audience"
            options={AUDIENCE_OPTIONS}
            value={form.audience}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, audience: e.target.value }))
            }
            disabled={submitting}
          />

          <Select
            label="Priority / Urgency"
            options={PRIORITY_OPTIONS}
            value={form.priority}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, priority: e.target.value }))
            }
            disabled={submitting}
          />

          <Input
            label="Expiry Date (Optional)"
            type="date"
            value={form.expiresAt}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, expiresAt: e.target.value }))
            }
            disabled={submitting}
          />
        </div>

        {/* Publish immediately checkbox */}
        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="isPublished"
            checked={form.isPublished}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, isPublished: e.target.checked }))
            }
            disabled={submitting}
            className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500"
          />
          <label htmlFor="isPublished" className="text-sm text-slate-700">
            Publish immediately (visible to recipients now)
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            iconLeft={Send}
          >
            {isEditing ? 'Save Changes' : form.isPublished ? 'Publish Announcement' : 'Save as Draft'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Main Admin Announcements Page
 */
export default function AdminAnnouncementsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { id: paramId } = useParams();

  // URL Filters
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebounce(search, 400);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [audienceFilter, setAudienceFilter] = useState(searchParams.get('audience') || 'all');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const limit = 10;

  // Announcements State
  const [announcements, setAnnouncements] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals
  const [viewId, setViewId] = useState(() => paramId || searchParams.get('id') || null);
  const [formModalOpen, setFormModalOpen] = useState(
    () => searchParams.get('new') === 'true',
  );
  const [editingItem, setEditingItem] = useState(null);

  // Confirmation dialogs
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [togglePublishItem, setTogglePublishItem] = useState(null);
  const [togglingPublish, setTogglingPublish] = useState(false);

  // Sync to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
    if (audienceFilter && audienceFilter !== 'all') params.set('audience', audienceFilter);
    if (page > 1) params.set('page', String(page));
    setSearchParams(params, { replace: true });
  }, [debouncedSearch, statusFilter, audienceFilter, page, setSearchParams]);

  // Fetch announcements
  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAnnouncements(
        {
          page,
          limit,
          search: debouncedSearch,
          status: statusFilter,
          audience: audienceFilter,
        },
        'admin',
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
  }, [page, limit, debouncedSearch, statusFilter, audienceFilter]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // Handle Delete
  const handleDeleteConfirm = async () => {
    if (!toDelete || deleting) return;
    const id = toDelete.id || toDelete._id;
    setDeleting(true);
    try {
      await deleteAnnouncement(id);
      toast.success('Announcement deleted successfully');
      setToDelete(null);
      fetchAnnouncements();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to delete';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  // Handle Toggle Publish
  const handleTogglePublishConfirm = async () => {
    if (!togglePublishItem || togglingPublish) return;
    const id = togglePublishItem.id || togglePublishItem._id;
    const newPublishState = !togglePublishItem.isPublished && togglePublishItem.status !== 'published';

    setTogglingPublish(true);
    try {
      await togglePublishAnnouncement(id, newPublishState);
      toast.success(
        newPublishState
          ? 'Announcement published to residents and staff'
          : 'Announcement unpublished (moved to drafts)',
      );
      setTogglePublishItem(null);
      fetchAnnouncements();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to update publication status';
      toast.error(msg);
    } finally {
      setTogglingPublish(false);
    }
  };

  // Metrics
  const stats = useMemo(() => {
    const publishedCount = announcements.filter(
      (a) => a.isPublished || a.status === 'published',
    ).length;
    const draftsCount = announcements.filter(
      (a) => !a.isPublished && a.status !== 'published',
    ).length;
    return { publishedCount, draftsCount };
  }, [announcements]);

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <PageHeader
        title="Community Announcements"
        subtitle="Manage building notices, alerts, and operational bulletins"
        icon={<Megaphone size={22} />}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchAnnouncements}
              disabled={loading}
              title="Refresh announcements"
            >
              <RefreshCw size={16} />
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingItem(null);
                setFormModalOpen(true);
              }}
              iconLeft={Plus}
            >
              New Announcement
            </Button>
          </div>
        }
      />

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
            <Megaphone size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Announcements</p>
            <p className="text-lg font-bold text-slate-800">{total}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Published Notices</p>
            <p className="text-lg font-bold text-emerald-600">{stats.publishedCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Drafts</p>
            <p className="text-lg font-bold text-slate-700">{stats.draftsCount}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row items-center gap-3">
        <div className="flex-1 w-full">
          <SearchInput
            placeholder="Search announcements by title or content..."
            value={search}
            onChange={setSearch}
            onClear={() => setSearch('')}
          />
        </div>

        <div className="w-full sm:w-48 shrink-0">
          <Select
            options={STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="w-full sm:w-48 shrink-0">
          <Select
            options={[{ value: 'all', label: 'All Audiences' }, ...AUDIENCE_OPTIONS]}
            value={audienceFilter}
            onChange={(e) => {
              setAudienceFilter(e.target.value);
              setPage(1);
            }}
          />
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
            title="Failed to load announcements"
            description={error}
            onRetry={fetchAnnouncements}
          />
        </div>
      ) : announcements.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <EmptyState
            icon={Megaphone}
            title={
              search || statusFilter !== 'all' || audienceFilter !== 'all'
                ? 'No matching announcements'
                : 'No announcements posted yet'
            }
            description={
              search || statusFilter !== 'all' || audienceFilter !== 'all'
                ? 'Try adjusting your filters or search keywords.'
                : 'Keep residents and staff informed by creating your first community bulletin.'
            }
            action={{
              label: 'Create Announcement',
              onClick: () => {
                setEditingItem(null);
                setFormModalOpen(true);
              },
              icon: Plus,
            }}
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Title & Preview</th>
                  <th className="py-3 px-4">Audience</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {announcements.map((a) => {
                  const id = a.id || a._id;
                  const isPublished =
                    a.isPublished !== undefined
                      ? a.isPublished
                      : a.status === 'published';

                  return (
                    <tr key={id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 max-w-xs sm:max-w-md">
                        <span className="font-semibold text-slate-800 block truncate">
                          {a.title}
                        </span>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {a.content || a.message || '—'}
                        </p>
                      </td>

                      <td className="py-3 px-4 capitalize">
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                          {a.audience || 'All'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-medium ${
                            a.priority === 'urgent'
                              ? 'bg-rose-100 text-rose-700'
                              : a.priority === 'high'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {a.priority || 'Normal'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <StatusBadge
                          status={a.status || (isPublished ? 'published' : 'draft')}
                        />
                      </td>

                      <td className="py-3 px-4 text-slate-500 text-xs whitespace-nowrap">
                        {formatDate(a.createdAt)}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewId(id)}
                            iconLeft={Eye}
                            title="View full notice"
                          >
                            View
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingItem(a);
                              setFormModalOpen(true);
                            }}
                            iconLeft={Edit}
                            title="Edit notice"
                          >
                            Edit
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className={
                              isPublished
                                ? 'text-amber-600 hover:bg-amber-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }
                            onClick={() => setTogglePublishItem(a)}
                            title={isPublished ? 'Unpublish notice' : 'Publish notice'}
                          >
                            {isPublished ? 'Unpublish' : 'Publish'}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-rose-600 hover:bg-rose-50 p-1.5"
                            onClick={() => setToDelete(a)}
                            title="Delete notice"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-200">
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

      {/* Form Modal */}
      <AnnouncementFormModal
        isOpen={formModalOpen}
        onClose={() => {
          setFormModalOpen(false);
          setEditingItem(null);
        }}
        initialData={editingItem}
        onSuccess={fetchAnnouncements}
      />

      {/* Detail Modal */}
      <AnnouncementDetailModal
        isOpen={Boolean(viewId)}
        onClose={() => setViewId(null)}
        announcementId={viewId}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={Boolean(toDelete)}
        onClose={() => {
          if (!deleting) setToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Announcement?"
        message={
          toDelete
            ? `Are you sure you want to delete "${toDelete.title}"? This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete Notice"
        variant="danger"
        loading={deleting}
      />

      {/* Toggle Publish Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={Boolean(togglePublishItem)}
        onClose={() => {
          if (!togglingPublish) setTogglePublishItem(null);
        }}
        onConfirm={handleTogglePublishConfirm}
        title={
          togglePublishItem?.isPublished || togglePublishItem?.status === 'published'
            ? 'Unpublish Announcement?'
            : 'Publish Announcement?'
        }
        message={
          togglePublishItem
            ? togglePublishItem.isPublished || togglePublishItem.status === 'published'
              ? `Unpublishing "${togglePublishItem.title}" will hide it from residents and staff.`
              : `Publishing "${togglePublishItem.title}" will make it immediately visible to the selected audience (${togglePublishItem.audience || 'All'}).`
            : ''
        }
        confirmLabel={
          togglePublishItem?.isPublished || togglePublishItem?.status === 'published'
            ? 'Unpublish'
            : 'Publish Now'
        }
        variant="primary"
        loading={togglingPublish}
      />
    </div>
  );
}
