import { useNavigate } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import Button from '../components/ui/Button';

export default function ForbiddenPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-6">
        <ShieldOff size={28} className="text-red-400" aria-hidden="true" />
      </div>
      <h1 className="text-4xl font-bold text-slate-800 mb-2">403</h1>
      <p className="text-base font-medium text-slate-600 mb-1">Access Denied</p>
      <p className="text-sm text-slate-400 mb-8 max-w-sm">
        You do not have permission to view this page. Contact your administrator if you believe
        this is a mistake.
      </p>
      <Button variant="secondary" onClick={() => navigate(-1)}>
        Go Back
      </Button>
    </div>
  );
}
