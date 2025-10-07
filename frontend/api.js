// api.js - API Utility Functions

const API_BASE = '/api';

export const getToken = () => localStorage.getItem('token');
export const setToken = (token) => localStorage.setItem('token', token);
export const removeToken = () => { 
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');
};

/**
 * Generic function to handle API requests.
 * @param {string} endpoint - The API path (e.g., /auth/login).
 * @param {object} options - Fetch options (method, body, headers).
 * @returns {Promise<object>} - { success: boolean, data: object|null, msg: string|null }
 */
export const fetchData = async (endpoint, options = {}) => {
    const token = getToken();
    
    options.headers = {
        'Content-Type': 'application/json',
        ...options.headers 
    };
    
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        
        if (response.status === 401 || response.status === 403) {
            removeToken();
            return { success: false, msg: 'Authentication failed. Please log in again.', status: response.status };
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            return { success: false, msg: data.msg || data.error || 'API Request Failed.', data: data };
        }

        return { success: true, data: data };

    } catch (error) {
        console.error('Network or Parse Error:', error);
        return { success: false, msg: 'A network error occurred. Check server connection.' };
    }
};