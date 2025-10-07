// profile.js
import { fetchData, getToken, removeToken } from './api.js';
import { showFlash } from './auth.js'; 

const profileForm = document.getElementById('profile-form');
const lenderSettingsContainer = document.getElementById('lender-settings-container');

// Redirect if not logged in
if (!getToken()) {
    window.location.href = 'login.html';
}

// --- Data Fetching and Initialization ---
const fetchProfile = async () => {
    
    const result = await fetchData('/user/profile');

    if (result.success) {
        const user = result.data;
        
        // Populate static fields
        document.getElementById('user-role-display').textContent = user.role.toUpperCase();
        document.getElementById('user-email-display').textContent = user.email;
        document.getElementById('kyc-status-display').textContent = user.kyc.verified ? 'Verified' : 'Pending Review';
        document.getElementById('kyc-status-display').className = user.kyc.verified ? 'user-status verified' : 'user-status unverified';

        // Populate form fields
        document.getElementById('profile-name').value = user.name || '';
        
        // Handle Lender Specific Fields
        if (user.role === 'lender' && user.lenderProfile) {
            lenderSettingsContainer.classList.remove('hidden');
            document.getElementById('maxAmount').value = user.lenderProfile.maxAmount || '';
            document.getElementById('interestRate').value = user.lenderProfile.interestRate || '';
        }

    } else {
        showFlash(result.msg || 'Failed to load profile data.', 'error');
        if (result.status === 401 || result.status === 403) removeToken();
    }
};

// --- Form Submission Handler ---
const setupFormSubmission = () => {
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('profile-name').value;
        const role = document.getElementById('user-role-display').textContent.toLowerCase();
        
        const updateData = { name };

        if (role === 'lender') {
            updateData.maxAmount = document.getElementById('maxAmount').value;
            updateData.interestRate = document.getElementById('interestRate').value;
        }

        const result = await fetchData('/user/profile', {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });

        if (result.success) {
            showFlash(result.data.msg || 'Profile updated successfully!', 'success');
            fetchProfile(); 
        } else {
            showFlash(result.msg || 'Failed to save profile.', 'error');
        }
    });
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    fetchProfile();
    setupFormSubmission();
});