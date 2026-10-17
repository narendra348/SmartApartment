import { NavLink } from 'react-router-dom';
import { BarChart3, TrendingUp, PieChart } from 'lucide-react';
import { ROUTES } from '../../../constants';

const REPORT_TABS = [
  {
    to: ROUTES.ADMIN.REPORTS_COLLECTIONS,
    label: 'Collections Report',
    icon: BarChart3,
  },
  {
    to: ROUTES.ADMIN.REPORTS_OUTSTANDING,
    label: 'Outstanding Dues',
    icon: TrendingUp,
  },
  {
    to: ROUTES.ADMIN.REPORTS_EXPENSES,
    label: 'Expense Ledger',
    icon: PieChart,
  },
];

export default function ReportsNavTabs() {
  return (
    <div className="flex border-b border-slate-200 gap-1 bg-white px-2 pt-2 rounded-t-xl">
      {REPORT_TABS.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                isActive
                  ? 'border-sky-600 text-sky-600 bg-sky-50/50 rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`
            }
          >
            <Icon size={16} />
            {tab.label}
          </NavLink>
        );
      })}
    </div>
  );
}
