// api.js

const API_BASE_URL = '/api'; // Assuming the client serves from the same domain as the API

// --- Token Management ---

const getToken = () => localStorage.getItem('token');
const setToken = (token) => localStorage.setItem('token', token);
const removeToken = () => localStorage.removeItem('token');

// --- Helper for making authenticated requests ---

const fetchData = async (endpoint, options = {}) => {
    const token = getToken();
    
    // Add Authorization header if a token exists
    if (token) {
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };
    }

    // Ensure Content-Type is set for POST/PUT if body is JSON
    if (options.body && !(options.body instanceof FormData) && !options.headers['Content-Type']) {
        options.headers['Content-Type'] = 'application/json';
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        
        // Handle 401/403 errors globally
        if (response.status === 401 || response.status === 403) {
            removeToken();
            // Redirect to login if unauthorized
            if (window.location.pathname !== '/login.html') {
                window.location.href = 'login.html';
            }
            return { success: false, msg: 'Authentication failed or expired.', status: response.status };
        }

        const data = await response.json();
        
        if (!response.ok) {
            // API error (e.g., 400 Bad Request)
            return { success: false, msg: data.error || data.msg || 'An API error occurred.', status: response.status };
        }

        return { success: true, data: data };

    } catch (error) {
        console.error('Fetch error:', error);
        return { success: false, msg: 'Network error or unable to reach server.' };
    }
};

// --- Exported functions ---

export { 
    setToken, 
    removeToken, 
    getToken, 
    fetchData 
};