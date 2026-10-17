import { Link } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import Button from '../components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-6">
        <FileQuestion size={28} className="text-slate-400" aria-hidden="true" />
      </div>
      <h1 className="text-4xl font-bold text-slate-800 mb-2">404</h1>
      <p className="text-base font-medium text-slate-600 mb-1">Page not found</p>
      <p className="text-sm text-slate-400 mb-8 max-w-sm">
        The page you are looking for does not exist or has been moved.
      </p>
      <Button as={Link} to="/" variant="primary">
        Go to Home
      </Button>
    </div>
  );
}
