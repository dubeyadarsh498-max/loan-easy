// create_loan.js
import { fetchData, getToken } from './api.js';

const form = document.getElementById('create-loan-form');
const userRole = localStorage.getItem('userRole');

const checkPermissions = () => {
    if (!getToken() || userRole !== 'borrower') {
        alert('Access Denied: Only logged-in borrowers can create loan requests.');
        window.location.href = 'index.html';
        return false;
    }
    return true;
};

const setupFormSubmission = () => {
    if (!checkPermissions()) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const amount = Number(document.getElementById('amount').value);
        const interestRate = Number(document.getElementById('interest_rate').value);
        const periodMonths = Number(document.getElementById('term_months').value);
        const purpose = document.getElementById('purpose').value; // Purpose is not in model, but sent anyway

        const result = await fetchData('/loans/create', {
            method: 'POST',
            body: JSON.stringify({ amount, interestRate, periodMonths, purpose })
        });

        if (result.success) {
            let message = 'Loan request submitted successfully!';
            if (result.data.matched) {
                message += ` Automatically matched with a lender (${result.data.matched.name}). Check your dashboard.`;
            }
            alert(message);
            // Redirect to dashboard after successful creation
            window.location.href = 'dashboard.html';
        } else {
            alert(result.msg || 'Failed to create loan request.');
        }
    });
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    setupFormSubmission();
});