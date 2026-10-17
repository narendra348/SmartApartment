/**
 * Extract a meaningful error message from an Axios error or any thrown value.
 * @param {unknown} error - The caught error.
 * @param {string} [defaultMessage='Something went wrong. Please try again.']
 * @returns {string}
 */
export function getErrorMessage(error, defaultMessage = 'Something went wrong. Please try again.') {
  if (!error) return defaultMessage;

  // Axios error with a response body
  if (error?.response?.data) {
    const { data } = error.response;

    // Common API error shapes
    if (typeof data.message === 'string' && data.message.trim()) {
      return data.message;
    }
    if (typeof data.error === 'string' && data.error.trim()) {
      return data.error;
    }
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      const first = data.errors[0];
      if (typeof first === 'string') return first;
      if (typeof first?.message === 'string') return first.message;
    }
  }

  // Network error (no response received)
  if (error?.request && !error?.response) {
    return 'Unable to reach the server. Please check your internet connection.';
  }

  // Plain Error instance
  if (error instanceof Error && error.message) {
    return error.message;
  }

  // String thrown directly
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return defaultMessage;
}

/**
 * Check whether an Axios error has a specific HTTP status code.
 */
export function isHttpStatus(error, status) {
  return error?.response?.status === status;
}

/**
 * True if the error is a 401 Unauthorized response.
 */
export function isUnauthorized(error) {
  return isHttpStatus(error, 401);
}

/**
 * True if the error is a 403 Forbidden response.
 */
export function isForbidden(error) {
  return isHttpStatus(error, 403);
}

/**
 * True if the error is a 404 Not Found response.
 */
export function isNotFound(error) {
  return isHttpStatus(error, 404);
}

/**
 * True if the error is a 422 Unprocessable Entity (validation) response.
 */
export function isValidationError(error) {
  return isHttpStatus(error, 422);
}
