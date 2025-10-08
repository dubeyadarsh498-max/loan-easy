// create_loan.js
import { fetchData } from './api.js';
import { showFlash } from './auth.js';

const loanForm = document.getElementById('create-loan-form');
const kycWarning = document.getElementById('kyc-warning');

const checkKYCStatus = async () => {
    const result = await fetchData('/user/profile');
    
    if (result.success && result.kyc) {
        const isVerified = result.kyc.verified;
        
        if (!isVerified) {
            kycWarning.classList.remove('hidden');
            loanForm.querySelector('button[type="submit"]').disabled = true;
        } else {
            kycWarning.classList.add('hidden');
            loanForm.querySelector('button[type="submit"]').disabled = false;
        }
    } else {
        showFlash(result.msg || 'Error checking KYC status. Cannot submit loan.', 'error');
        loanForm.querySelector('button[type="submit"]').disabled = true;
    }
};


const handleCreateLoan = async (event) => {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);
    
    // Convert FormData to JSON object
    const data = Object.fromEntries(formData.entries());
    
    // Ensure numbers are sent as numbers
    data.amount = Number(data.amount);
    data.interestRate = Number(data.interestRate);
    data.periodMonths = Number(data.periodMonths);

    const result = await fetchData('/loans/create', {
        method: 'POST',
        body: JSON.stringify(data)
    });

    if (result.success) {
        let msg = `Loan request submitted successfully. Status: ${result.loan.status}.`;
        if (result.matched) {
            msg += ` Automatically matched with a lender!`;
        }
        showFlash(msg, 'success');
        form.reset();
        // Optional: Redirect to dashboard after a short delay
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);
    } else {
        showFlash(result.msg || 'Failed to create loan request.', 'error');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Redirect non-borrowers
    if (localStorage.getItem('userRole') !== 'borrower') {
        showFlash('Only Borrowers can request a loan.', 'error');
        // You might want to redirect them completely
        setTimeout(() => window.location.href = 'dashboard.html', 1500);
        return;
    }
    
    checkKYCStatus();
    loanForm.addEventListener('submit', handleCreateLoan);
});