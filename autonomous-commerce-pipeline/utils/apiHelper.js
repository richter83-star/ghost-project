import fetch from 'node-fetch';

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
          `API Error: ${response.status} ${response.statusText}. Body: ${JSON.stringify(errorBody)}`
        );
      }

      return await response.json();

    } catch (error) {
      console.warn(`Attempt ${i + 1}/${retries} failed for ${url}. Error: ${error.message}`);
      lastError = error;
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
  }
  // If all retries fail, throw the last error
  throw new Error(`All retries failed for ${url}. Last Error: ${lastError.message}`);
}