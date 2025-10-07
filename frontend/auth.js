// auth.js
import { fetchData, setToken } from './api.js';

const registerForm = document.getElementById('register-form');
const loginForm = document.getElementById('login-form');
const roleSelect = document.getElementById('role');
const lenderFields = document.getElementById('lender-fields');

// Flash message elements
const flash = document.getElementById('flash-message');
const flashText = document.querySelector('[data-target="flash-text"]');

// --- Flash Message Utility ---
export const showFlash = (message, type = 'success') => {
    flashText.textContent = message;
    flash.className = `flash-message ${type}`;
    flash.classList.remove('hidden');
    setTimeout(() => {
        flash.classList.add('hidden');
    }, 5000);
};

// --- UI Management ---

const handleRoleChange = () => {
    if (roleSelect && lenderFields) {
        roleSelect.addEventListener('change', (e) => {
            if (e.target.value === 'lender') {
                lenderFields.classList.remove('hidden');
            } else {
                lenderFields.classList.add('hidden');
            }
        });
        if (roleSelect.value === 'lender') {
            lenderFields.classList.remove('hidden');
        }
    }
};

// --- Form Submission Handlers ---

const setupRegister = () => {
    if (!registerForm) return;

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // IMPORTANT: Use FormData for file uploads
        const formData = new FormData(registerForm);

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                // Do NOT set Content-Type header when using FormData
                body: formData 
            });

            const result = await response.json();

            if (response.ok) {
                showFlash('Registration successful! Your KYC documents are under review. Please log in.', 'success');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            } else {
                showFlash(result.error || result.msg || 'Registration failed.', 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            showFlash('An unexpected error occurred during registration.', 'error');
        }
    });
};


const setupLogin = () => {
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        const result = await fetchData('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        if (result.success) {
            setToken(result.data.token);
            localStorage.setItem('userRole', result.data.user.role); 
            localStorage.setItem('userId', result.data.user.id);
            
            showFlash(`Welcome back, ${result.data.user.name}!`, 'success');
            
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 500);

        } else {
            showFlash(result.msg || 'Login failed. Invalid credentials.', 'error');
        }
    });
};


// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    handleRoleChange();
    setupRegister();
    setupLogin();
});