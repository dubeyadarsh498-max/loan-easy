// profile.js
import { fetchData } from './api.js';
import { showFlash } from './auth.js';

const profileForm = document.getElementById('profile-form');
const userRoleDisplay = document.getElementById('user-role-display');
const lenderFields = document.getElementById('lender-fields');
const userId = localStorage.getItem('userId');
const userRole = localStorage.getItem('userRole');

if (!userId || !userRole) {
    window.location.href = 'login.html';
}

const loadProfile = async () => {
    const result = await fetchData(`/user/profile`);
    
    if (result.success && result.email) {
        const user = result;
        
        // Populate general fields
        document.getElementById('name').value = user.name;
        document.getElementById('email').value = user.email;
        userRoleDisplay.textContent = user.role.toUpperCase();

        // Populate lender-specific fields
        if (user.role === 'lender') {
            lenderFields.classList.remove('hidden');
            document.getElementById('maxAmount').value = user.lenderProfile?.maxAmount || '';
            document.getElementById('interestRate').value = user.lenderProfile?.interestRate || '';
        } else {
            lenderFields.classList.add('hidden');
        }
        
    } else {
        showFlash(result.msg || 'Failed to load profile data.', 'error');
    }
};

const handleProfileUpdate = async (event) => {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);
    const data = { name: formData.get('name') };
    
    // Include lender fields only if the user is a lender
    if (userRole === 'lender') {
        data.maxAmount = formData.get('maxAmount');
        data.interestRate = formData.get('interestRate');
    }

    const result = await fetchData('/user/profile', {
        method: 'PUT',
        body: JSON.stringify(data)
    });

    if (result.success) {
        showFlash(result.msg || 'Profile updated successfully!', 'success');
        // Update local storage if name changed
        // In a real app, you might want to reload or update the display
    } else {
        showFlash(result.msg || 'Failed to update profile.', 'error');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    loadProfile();
    profileForm.addEventListener('submit', handleProfileUpdate);
});