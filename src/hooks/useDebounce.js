import { useState, useEffect, useRef } from 'react';

/**
 * useDebounce — returns a debounced version of the given value.
 *
 * @param {*}      value
 * @param {number} delay - Milliseconds to wait (default 400)
 */
export function useDebounce(value, delay = 400) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
