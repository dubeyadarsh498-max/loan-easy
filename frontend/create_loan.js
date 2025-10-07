// create_loan.js
import { fetchData, getToken, removeToken } from './api.js';
import { showFlash } from './auth.js'; 

const createLoanForm = document.getElementById('create-loan-form');
const userRole = localStorage.getItem('userRole');

// Redirect if not borrower or not logged in
if (!getToken() || userRole !== 'borrower') {
    showFlash('Access Denied: Only logged-in borrowers can create loan requests.', 'error');
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1500);
}


// --- Form Submission Handler ---
createLoanForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const amount = document.getElementById('loan-amount').value;
    const interestRate = document.getElementById('loan-interest').value;
    const periodMonths = document.getElementById('loan-period').value;

    const result = await fetchData('/loans/create', {
        method: 'POST',
        body: JSON.stringify({ amount, interestRate, periodMonths })
    });

    if (result.success) {
        const matchedMessage = result.data.matched 
            ? `Successfully matched with Lender ${result.data.matched.name}! Check dashboard to accept.`
            : `Loan request created! Status is 'open'. We will notify you when a lender expresses interest.`;
        
        showFlash(matchedMessage, 'success'); 
        createLoanForm.reset();
        
    } else {
        showFlash(result.msg || 'Failed to create loan request. Check KYC status.', 'error'); 
    }
});