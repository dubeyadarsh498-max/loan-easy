// auth.js
import { fetchData, setToken, clearToken, getToken } from './api.js';

// Utility function to display flash messages (FIXED)
export const showFlash = (message, type = 'success') => {
    const container = document.getElementById('flash-container');
    
    // FIX: Check if the container exists before trying to use it
    if (!container) {
        return; 
    }
    
    container.innerHTML = '';

    const messageDiv = document.createElement('div');
    messageDiv.className = `flash-message flash-${type}`;
    messageDiv.textContent = message;

    container.appendChild(messageDiv);

    // Auto-hide after 5 seconds
    setTimeout(() => {
        if (container.contains(messageDiv)) {
            container.removeChild(messageDiv);
        }
    }, 5000);
};

// Function to control which navigation links are shown
const updateNavigation = (role) => {
    const links = document.querySelectorAll('[data-auth-link]');
    
    links.forEach(link => {
        const target = link.getAttribute('data-auth-link');
        link.classList.add('hidden'); // Hide all by default

        if (!role) {
            // Logged OUT state
            if (target === 'login' || target === 'register') {
                link.classList.remove('hidden');
            }
        } else {
            // Logged IN state
            if (target === 'dashboard' || target === 'profile' || target === 'logout') {
                link.classList.remove('hidden');
            }
            if (role === 'admin' && target === 'admin') {
                 link.classList.remove('hidden');
            }
        }
    });

    // Handle logout click
    const logoutLink = document.querySelector('[data-auth-link="logout"]');
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            clearToken();
            window.location.href = 'login.html';
        });
    }
};

// Function to update the copyright year in the footer
const updateFooterYear = () => {
    const yearSpan = document.getElementById('current-year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    updateFooterYear(); // Run the footer update
    
    const token = getToken();
    const role = localStorage.getItem('userRole');
    
    if (token && role) {
        updateNavigation(role);
    } else {
        updateNavigation(null);
    }
    
    // --- Form Handlers ---
    const registerForm = document.getElementById('register-form');
    const loginForm = document.getElementById('login-form');
    
    // Hide/Show Lender fields on register page
    const roleSelect = document.getElementById('role');
    const lenderFields = document.getElementById('lender-fields');
    
    if (roleSelect && lenderFields) {
        roleSelect.addEventListener('change', () => {
            if (roleSelect.value === 'lender') {
                lenderFields.classList.remove('hidden');
            } else {
                lenderFields.classList.add('hidden');
            }
        });
        // Initial check
        if (roleSelect.value === 'lender') {
            lenderFields.classList.remove('hidden');
        }
    }

    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Check for success/error flash messages on page load (if applicable)
    const urlParams = new URLSearchParams(window.location.search);
    const flashMsg = urlParams.get('flash');
    const flashType = urlParams.get('type') || 'success';
    
    if (flashMsg) {
        showFlash(decodeURIComponent(flashMsg), flashType);
    }
});


async function handleRegister(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);

    const result = await fetchData('/auth/register', {
        method: 'POST',
        body: formData 
    }, false, true); // Send as multipart

    if (result.success) {
        const encodedMsg = encodeURIComponent('Registration successful! Please login. Your KYC documents are under review.');
        window.location.href = `login.html?flash=${encodedMsg}&type=success`;
    } else {
        showFlash(result.msg || 'Registration failed. Please check the form and try again.', 'error');
    }
}

async function handleLogin(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    const result = await fetchData('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data)
    }, false); // Login does not require a token

    if (result.success) {
        setToken(result.token);
        localStorage.setItem('userRole', result.user.role);
        localStorage.setItem('userId', result.user.id);
        
        // Redirect based on role
        if (result.user.role === 'admin') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'dashboard.html';
        }
    } else {
        showFlash(result.msg || 'Login failed. Invalid credentials.', 'error');
    }
}