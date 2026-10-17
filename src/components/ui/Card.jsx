function Card({ children, className = '', padding = true, ...rest }) {
  return (
    <div
      className={[
        'bg-white rounded-lg border border-slate-200 shadow-sm',
        padding ? 'p-5' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}

function CardHeader({ children, className = '' }) {
  return (
    <div
      className={`flex items-center justify-between gap-3 pb-4 border-b border-slate-100 mb-4 ${className}`}
    >
      {children}
    </div>
  );
}

function CardTitle({ children, className = '' }) {
  return (
    <h3 className={`text-base font-semibold text-slate-800 ${className}`}>
      {children}
    </h3>
  );
}

function CardBody({ children, className = '' }) {
  return <div className={className}>{children}</div>;
}

function CardFooter({ children, className = '' }) {
  return (
    <div
      className={`flex items-center gap-3 pt-4 border-t border-slate-100 mt-4 ${className}`}
    >
      {children}
    </div>
  );
}

Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Body = CardBody;
Card.Footer = CardFooter;

export default Card;
