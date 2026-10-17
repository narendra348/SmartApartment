import { useNavigate, useLocation } from 'react-router-dom';
import { Construction, ArrowLeft } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';

export default function ModulePlaceholder({ title, description }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { getDashboardRoute } = useAuth();

  const moduleName =
    title ||
    location.pathname
      .split('/')
      .filter(Boolean)
      .pop()
      ?.replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase()) ||
    'Module';

  return (
    <div className="space-y-6">
      <PageHeader
        title={moduleName}
        subtitle="This feature is scheduled for development in an upcoming phase."
        breadcrumbs={[
          { label: 'Dashboard', href: getDashboardRoute() },
          { label: moduleName },
        ]}
      />

      <div className="bg-white rounded-xl border border-slate-200 p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center mx-auto mb-4">
          <Construction size={32} />
        </div>
        <h2 className="text-lg font-semibold text-slate-800 mb-2">
          {moduleName} Module Under Construction
        </h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
          {description ||
            'The detailed business workflow for this module will be introduced in the subsequent development prompts. All core routes, navigation, and role security are active.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="secondary"
            onClick={() => navigate(-1)}
            iconLeft={ArrowLeft}
          >
            Go Back
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate(getDashboardRoute())}
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
