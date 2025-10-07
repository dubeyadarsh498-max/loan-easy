// auth.js
import { setToken, fetchData } from './api.js';

const flash = document.getElementById('flash-message');
const flashText = document.querySelector('[data-target="flash-text"]');

const showFlash = (message, type = 'success') => {
    flashText.textContent = message;
    flash.className = `flash-message ${type}`;
    flash.classList.remove('hidden');
    setTimeout(() => {
        flash.classList.add('hidden');
    }, 5000);
};

const setupLogin = () => {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        const result = await fetchData('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        if (result.success) {
            setToken(result.data.token);
            // Store basic user info for quick access
            localStorage.setItem('userRole', result.data.user.role);
            
            showFlash('Login successful! Redirecting to dashboard...', 'success');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        } else {
            showFlash(result.msg || 'Login failed.', 'error');
        }
    });
};

const setupRegister = () => {
    const registerForm = document.getElementById('register-form');
    if (!registerForm) return;

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Note: Backend supports file uploads, but for simplicity here we assume no files for now
        // If files were needed, we'd use 'new FormData(registerForm)' and remove JSON content-type
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const isLender = document.getElementById('is-lender').checked;
        
        const body = { 
            name, 
            email, 
            password, 
            role: isLender ? 'lender' : 'borrower'
            // If KYC files/lender profile details were on the form, add them here
        };

        const result = await fetchData('/auth/register', {
            method: 'POST',
            body: JSON.stringify(body)
        });

        if (result.success) {
            showFlash('Registration successful! Please log in.', 'success');
            // Redirect to login page
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);
        } else {
            showFlash(result.msg || 'Registration failed.', 'error');
        }
    });
};

// Determine which form to set up based on the current page
if (window.location.pathname.includes('login.html')) {
    setupLogin();
} else if (window.location.pathname.includes('register.html')) {
    setupRegister();
}