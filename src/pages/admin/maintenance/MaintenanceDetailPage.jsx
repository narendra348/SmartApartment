import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Wrench,
  ChevronLeft,
  Building2,
  Home,
  User,
  Calendar,
  Tag,
  MessageSquare,
  RefreshCw,
  Send,
  CheckCircle,
  Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../../components/ui/PageHeader';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import StatusBadge from '../../../components/ui/StatusBadge';
import Select from '../../../components/ui/Select';
import Textarea from '../../../components/ui/Textarea';
import { PageLoader } from '../../../components/ui/LoadingSpinner';
import { ErrorState } from '../../../components/ui/StateViews';
import {
  getMaintenanceRequestById,
  updateMaintenanceRequest,
  addMaintenanceComment,
} from '../../../api/maintenanceApi';
import { ROUTES } from '../../../constants';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const PRIORITY_CONFIG = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-sky-100 text-sky-700',
  high: 'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-600',
};

function MetaRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-sm text-slate-800 mt-0.5 break-words">{value || '—'}</p>
      </div>
    </div>
  );
}

function CommentBubble({ comment }) {
  const text = comment.comment ?? comment.text ?? comment.content ?? comment.note ?? '';
  const author = comment.author ?? comment.authorName ?? comment.createdBy ?? 'System';
  const date = comment.createdAt ?? comment.date ?? comment.timestamp;

  return (
    <div className="flex flex-col gap-1 p-3 bg-slate-50 rounded-lg">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700">{author}</span>
        {date && (
          <span className="text-xs text-slate-400">
            {new Date(date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>
      <p className="text-sm text-slate-700 leading-relaxed">{text}</p>
    </div>
  );
}

export default function MaintenanceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Status/priority update
  const [newStatus, setNewStatus] = useState('');
  const [newPriority, setNewPriority] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Comment
  const [commentText, setCommentText] = useState('');
  const [addingComment, setAddingComment] = useState(false);

  const fetchRequest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMaintenanceRequestById(id, 'admin');
      setRequest(data);
      setNewStatus(data.status ?? 'pending');
      setNewPriority(data.priority ?? 'medium');
    } catch (err) {
      const msg = err.response?.data?.message ?? err.message ?? 'Failed to load request';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRequest();
  }, [fetchRequest]);

  async function handleStatusUpdate() {
    setUpdatingStatus(true);
    try {
      const updated = await updateMaintenanceRequest(id, {
        status: newStatus,
        priority: newPriority,
      });
      setRequest((prev) => ({ ...prev, ...updated }));
      toast.success('Request updated');
    } catch (err) {
      const msg = err.response?.data?.message ?? err.message ?? 'Update failed';
      toast.error(msg);
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleAddComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setAddingComment(true);
    try {
      await addMaintenanceComment(id, commentText.trim(), 'admin');
      setCommentText('');
      toast.success('Note added');
      fetchRequest(); // refresh to see updated comments from backend
    } catch (err) {
      const msg = err.response?.data?.message ?? err.message ?? 'Failed to add note';
      toast.error(msg);
    } finally {
      setAddingComment(false);
    }
  }

  function formatDate(val) {
    if (!val) return '—';
    return new Date(val).toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  if (loading) return <PageLoader />;
  if (error) return <ErrorState description={error} onRetry={fetchRequest} />;
  if (!request) return null;

  const ticketNum =
    request.ticketNumber ??
    request.requestNumber ??
    request.complaintNumber ??
    `#${String(id).slice(-6)}`;

  const building = request.building?.name ?? request.buildingName ?? request.building;
  const flat = request.flat?.number ?? request.flatNumber ?? request.unit ?? request.flat;
  const residentName =
    request.residentName ??
    request.resident?.name ??
    request.submittedBy?.name ??
    request.createdBy?.name;
  const category = (request.category ?? '').replace(/_/g, ' ');
  const priorityCls = PRIORITY_CONFIG[(request.priority || '').toLowerCase()] ?? 'bg-slate-100 text-slate-600';

  const comments =
    request.comments ??
    request.notes ??
    request.history?.filter((h) => h.comment || h.text || h.note) ??
    [];

  const statusChanged = newStatus !== request.status || newPriority !== request.priority;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Request ${ticketNum}`}
        subtitle={request.subject ?? request.title ?? ''}
        icon={<Wrench size={22} />}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchRequest()}
          title="Refresh"
        >
          <RefreshCw size={16} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(ROUTES.ADMIN.COMPLAINTS)}
        >
          <ChevronLeft size={16} />
          Back
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: main details */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Description card */}
          <Card>
            <div className="p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Description</h3>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {request.description ?? '—'}
              </p>
            </div>
          </Card>

          {/* Comments / history */}
          <Card>
            <div className="p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <MessageSquare size={16} className="text-slate-400" />
                Notes &amp; Comments
                {comments.length > 0 && (
                  <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                    {comments.length}
                  </span>
                )}
              </h3>

              {comments.length > 0 ? (
                <div className="flex flex-col gap-3 mb-4">
                  {comments.map((c, i) => (
                    <CommentBubble key={c._id ?? c.id ?? i} comment={c} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 mb-4">No notes yet.</p>
              )}

              {/* Add comment form */}
              <form onSubmit={handleAddComment} className="flex flex-col gap-3">
                <Textarea
                  id="comment-text"
                  name="comment"
                  placeholder="Add a note or comment…"
                  rows={3}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  disabled={addingComment}
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={!commentText.trim() || addingComment}
                    loading={addingComment}
                  >
                    <Send size={14} />
                    Add Note
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>

        {/* Right: metadata + status update */}
        <div className="flex flex-col gap-6">
          {/* Status update */}
          <Card>
            <div className="p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Update Request</h3>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Status</label>
                  <Select
                    value={newStatus}
                    onChange={setNewStatus}
                    options={STATUS_OPTIONS}
                    disabled={updatingStatus}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Priority</label>
                  <Select
                    value={newPriority}
                    onChange={setNewPriority}
                    options={PRIORITY_OPTIONS}
                    disabled={updatingStatus}
                  />
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleStatusUpdate}
                  disabled={!statusChanged || updatingStatus}
                  loading={updatingStatus}
                  className="w-full justify-center"
                >
                  <CheckCircle size={15} />
                  Save Changes
                </Button>
              </div>
            </div>
          </Card>

          {/* Request metadata */}
          <Card>
            <div className="px-5 pt-4 pb-2">
              <h3 className="text-sm font-semibold text-slate-700 mb-1">Details</h3>
            </div>
            <div className="px-5 pb-4">
              <div className="flex items-center gap-2 mb-4">
                <StatusBadge status={request.status} />
                {request.priority && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${priorityCls}`}>
                    {request.priority}
                  </span>
                )}
              </div>

              <MetaRow
                icon={<Tag size={14} />}
                label="Category"
                value={<span className="capitalize">{category || '—'}</span>}
              />
              {residentName && (
                <MetaRow icon={<User size={14} />} label="Submitted By" value={residentName} />
              )}
              {building && (
                <MetaRow icon={<Building2 size={14} />} label="Building" value={building} />
              )}
              {flat && (
                <MetaRow icon={<Home size={14} />} label="Flat / Unit" value={`Flat ${flat}`} />
              )}
              <MetaRow
                icon={<Calendar size={14} />}
                label="Submitted"
                value={formatDate(request.createdAt ?? request.date ?? request.submittedAt)}
              />
              {request.updatedAt && (
                <MetaRow
                  icon={<Clock size={14} />}
                  label="Last Updated"
                  value={formatDate(request.updatedAt)}
                />
              )}
              {request.resolvedAt && (
                <MetaRow
                  icon={<CheckCircle size={14} />}
                  label="Resolved"
                  value={formatDate(request.resolvedAt)}
                />
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
