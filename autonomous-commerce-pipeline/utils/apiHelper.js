import fetch from 'node-fetch';

/**
 * Utility function to redact API keys in a string
 * - If it's a URL with ?key=... / &key=..., redact just that param
 * - Otherwise, mask most of the string (for logging raw tokens safely)
 */
export function redactApiKey(value) {
  if (!value) return '';
  const str = String(value);

  // Redact common 'key' query parameter pattern in URLs
  const urlRedacted = str.replace(/([?&]key=)[^&]+/gi, '$1[REDACTED]');
  if (urlRedacted !== str) {
    return urlRedacted;
  }

  // Fallback: treat as raw token/key
  if (str.length <= 6) {
    return '*'.repeat(str.length || 4);
  }

  const start = str.slice(0, 4);
  const end = str.slice(-2);
  const middleMask = '*'.repeat(str.length - 6);

  return `${start}${middleMask}${end}`;
}

/**
 * A utility function to perform fetch requests with exponential backoff.
 * @param {string} url - The URL to fetch.
 * @param {object} options - The options for node-fetch (method, headers, body).
 * @param {number} retries - The maximum number of retries.
 * @param {number} delay - The initial delay in ms.
 * @returns {Promise<object>} - The JSON response.
 */
export async function fetchWithRetry(url, options, retries = 3, delay = 1000) {
  let lastError;

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        let errorBody;
        try {
          errorBody = await response.json();
        } catch (e) {
          errorBody = await response.text();
        }
        throw new Error(
          `API Error: ${response.status} ${response.statusText}. Url: ${redactApiKey(
            url
          )}. Body: ${JSON.stringify(errorBody)}`
        );
      }

      return await response.json();
    } catch (error) {
      console.warn(
        `Attempt ${i + 1}/${retries} failed for ${redactApiKey(
          url
        )}. Error: ${error.message}`
      );
      lastError = error;
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
  }
  // If all retries fail, throw the last error
  throw new Error(
    `All retries failed for ${redactApiKey(url)}. Last Error: ${
      lastError?.message || 'Unknown error'
    }`
  );
}
