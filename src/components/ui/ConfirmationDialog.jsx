import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" closeOnBackdrop={!loading}>
      <div className="flex flex-col items-center text-center gap-4">
        <div
          className={[
            'flex items-center justify-center w-12 h-12 rounded-full',
            variant === 'danger' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600',
          ].join(' ')}
        >
          <AlertTriangle size={22} aria-hidden="true" />
        </div>

        <div>
          <h2 className="text-base font-semibold text-slate-800 mb-1">{title}</h2>
          {message && <p className="text-sm text-slate-500">{message}</p>}
        </div>

        <div className="flex gap-3 w-full">
          <Button
            variant="secondary"
            fullWidth
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            fullWidth
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default ConfirmationDialog;
