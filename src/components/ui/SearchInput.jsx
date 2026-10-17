import { Search, X } from 'lucide-react';

function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  onClear,
  className = '',
  id = 'search-input',
}) {
  const handleClear = () => {
    if (onClear) {
      onClear();
    } else {
      onChange({ target: { value: '' } });
    }
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <Search
        size={15}
        className="absolute left-3 text-slate-400 pointer-events-none"
        aria-hidden="true"
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={placeholder}
        className="
          w-full h-9 pl-9 pr-9 rounded-md border border-slate-200 bg-white
          text-sm text-slate-900 placeholder-slate-400
          focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500
          transition-colors duration-150
        "
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export default SearchInput;
