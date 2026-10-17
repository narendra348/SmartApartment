import { useState, useCallback } from 'react';

/**
 * useAsync — wrapper for async operations with loading, error, and data state.
 *
 * @example
 * const { execute, loading, error, data } = useAsync();
 * await execute(() => client.get('/residents'));
 */
export function useAsync() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const execute = useCallback(async (asyncFn) => {
    setLoading(true);
    setError(null);

    try {
      const result = await asyncFn();
      setData(result);
      return result;
    } catch (err) {
      setError(err?.message ?? 'An error occurred');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setData(null);
  }, []);

  return { execute, loading, error, data, reset };
}
