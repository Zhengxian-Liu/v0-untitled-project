import { useAuth } from './authContext'; // Assuming context is in the same lib directory

// Define base URL using environment variable
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

// Type for fetch options (can be extended)
interface FetchOptions extends RequestInit {
    // Add any custom options if needed later
}

/**
 * A wrapper around the native fetch function that automatically:
 * 1. Prepends the API_BASE_URL to relative URLs.
 * 2. Adds the Authorization header with the JWT token if available.
 * 3. Sets Content-Type to application/json for relevant methods (POST, PUT, PATCH).
 * 4. Parses JSON response or throws a detailed error.
 */
export const apiClient = async <T = any>(
    endpoint: string,
    options: FetchOptions = {}
): Promise<T> => {
    // Cannot call hooks at the top level, so we need a way to get the token.
    // Option 1: Pass getToken function from context (requires context setup)
    // Option 2: Read directly from localStorage (simpler for now)
    let token: string | null = null;
    if (typeof window !== 'undefined') { // Check if running in browser
         try {
             token = localStorage.getItem('authToken');
         } catch (error) {
             console.error("Error accessing localStorage for token:", error);
         }
    }

    // Construct the full URL
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

    // Prepare headers
    const headers = new Headers(options.headers || {});
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    // Set default Content-Type for relevant methods if body exists and is not FormData
    const method = options.method?.toUpperCase() || 'GET';
    if (['POST', 'PUT', 'PATCH'].includes(method) && options.body && !(options.body instanceof FormData)) {
        if (!headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }
    }

    // Perform the fetch call
    try {
        const response = await fetch(url, {
            ...options,
            headers,
        });

        // Check for non-OK response status
        if (!response.ok) {
            let errorDetail = `HTTP error! Status: ${response.status} - ${response.statusText}`;
            try {
                // Try to parse error details from response body
                const errorData = await response.json();
                errorDetail = errorData.detail || errorDetail;
            } catch (e) { /* Ignore JSON parsing error */ }
            console.error(`API call failed: ${method} ${url}`, errorDetail);
            throw new Error(errorDetail);
        }

        // Handle empty response body (e.g., for 204 No Content)
        if (response.status === 204 || response.headers.get('Content-Length') === '0') {
            return undefined as T; // Or null, depending on expected return type
        }

        // Parse successful JSON response
        const data: T = await response.json();
        return data;

    } catch (error) {
        console.error(`API call error: ${method} ${url}`, error);
        // Re-throw the error so calling components can handle it
        throw error;
    }
}; 