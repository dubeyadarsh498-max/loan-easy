// api.js

// IMPORTANT: Ensure this port matches the PORT defined in your server.js (usually 5000)
const BASE_URL = 'http://localhost:5000/api'; 

export const getToken = () => localStorage.getItem('token');
export const setToken = (token) => localStorage.setItem('token', token);
export const clearToken = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId'); 
};

/**
 * Generic function to fetch data from the backend API.
 */
export const fetchData = async (endpoint, options = {}, authRequired = true, multipart = false) => {
    const headers = {};

    if (!multipart) {
        headers['Content-Type'] = 'application/json';
    }

    if (authRequired && getToken()) {
        headers['Authorization'] = `Bearer ${getToken()}`;
    }

    const config = {
        ...options,
        headers: headers,
    };
    
    // For multipart, the browser handles the content type
    if (multipart) {
        delete config.headers['Content-Type'];
    } 

    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, config);
        
        // Handle connection refusal (server down)
        if (!response.ok && response.status === 0) {
            return { success: false, msg: 'Connection refused. Please ensure the backend server is running.' };
        }
        
        // Handle non-200 responses (e.g., 401, 403, 400)
        if (!response.ok) {
            // If the error is 401 (Unauthorized), force logout
            if (response.status === 401) {
                clearToken();
                // Optionally redirect to login page
            }
            const error = await response.json();
            return { success: false, msg: error.msg || error.error || 'API call failed.' };
        }

        const data = await response.json();
        return { success: true, ...data };
    } catch (error) {
        console.error('Network or Parse Error:', error);
        return { success: false, msg: 'Network error or unable to parse response.' };
    }
};