// dashboard.js
import { fetchData, getToken, removeToken } from './api.js';
import { showFlash } from './auth.js'; 

const loansBorrowedBody = document.getElementById('loans-borrowed-body');
const loansLentBody = document.getElementById('loans-lent-body');

const userId = localStorage.getItem('userId');
const userRole = localStorage.getItem('userRole');

// Redirect if not logged in
if (!getToken() || !userId) {
    window.location.href = 'login.html';
}

// --- Data Handlers ---

const handleResponse = async (loanId, action) => {
    const result = await fetchData(`/loans/${loanId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action })
    });

    if (result.success) {
        showFlash(`Loan response saved. Status: ${action}.`, 'success'); 
        fetchDashboardData();
    } else {
        showFlash(result.msg || 'Failed to respond to loan request.', 'error'); 
    }
};

const createBorrowerRow = (loan) => {
    const tr = document.createElement('tr');
    const shortId = loan._id.slice(-6).toUpperCase();
    const isMatched = loan.status === 'matched';
    const isAccepted = loan.status === 'accepted';
    
    tr.innerHTML = `
        <td>#${shortId}</td>
        <td>₹${loan.amount.toLocaleString()}</td>
        <td>${loan.interestRate}%</td>
        <td>${loan.periodMonths} mo</td>
        <td>${loan.status}</td>
        <td>${loan.matchedWith ? loan.matchedWith.name : 'N/A'}</td>
        <td>
            ${isMatched && !loan.borrowerAccepted ? `
                <button class="respond-btn" data-loan-id="${loan._id}" data-action="accept">Accept Match</button>
                <button class="respond-btn reject" data-loan-id="${loan._id}" data-action="reject">Reject</button>
            ` : isAccepted ? 'Finalized' : 'Waiting...'}
        </td>
    `;
    return tr;
};

const createLenderRow = (loan) => {
    const tr = document.createElement('tr');
    const shortId = loan._id.slice(-6).toUpperCase();
    const isMatched = loan.status === 'matched';
    const isAccepted = loan.status === 'accepted';

    tr.innerHTML = `
        <td>#${shortId}</td>
        <td>₹${loan.amount.toLocaleString()}</td>
        <td>${loan.interestRate}%</td>
        <td>${loan.borrower.name}</td>
        <td>${loan.status}</td>
        <td>
            ${isMatched && !loan.lenderAccepted ? `
                <button class="respond-btn" data-loan-id="${loan._id}" data-action="accept">Confirm Fund</button>
                <button class="respond-btn reject" data-loan-id="${loan._id}" data-action="reject">Withdraw Offer</button>
            ` : isAccepted ? 'Finalized' : 'Pending Borrower Acceptance'}
        </td>
    `;
    return tr;
};


// --- Data Fetching ---

const fetchDashboardData = async () => {
    // 1. Fetch Borrowed Loans
    const borrowedResult = await fetchData(`/loans/borrower/${userId}`);
    loansBorrowedBody.innerHTML = '';
    if (borrowedResult.success && borrowedResult.data.length > 0) {
        borrowedResult.data.forEach(loan => loansBorrowedBody.appendChild(createBorrowerRow(loan)));
    } else {
        loansBorrowedBody.innerHTML = `<tr><td colspan="7" class="empty-state-small">No loans requested yet.</td></tr>`;
    }

    // 2. Fetch Lent Loans (Lender only)
    if (userRole === 'lender') {
        const lentResult = await fetchData(`/loans/lender/${userId}`);
        document.getElementById('lender-dashboard-section').style.display = 'block';
        loansLentBody.innerHTML = '';
        if (lentResult.success && lentResult.data.length > 0) {
            lentResult.data.forEach(loan => loansLentBody.appendChild(createLenderRow(loan)));
        } else {
            loansLentBody.innerHTML = `<tr><td colspan="6" class="empty-state-small">No loans matched or funded yet.</td></tr>`;
        }
    } else {
        // Hide the lender section if not a lender
        document.getElementById('lender-dashboard-section').style.display = 'none';
    }

    // Attach listeners after DOM update
    setupResponseListeners();
};

// --- Event Listeners ---

const setupResponseListeners = () => {
    document.querySelectorAll('.respond-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const loanId = e.target.getAttribute('data-loan-id');
            const action = e.target.getAttribute('data-action');
            handleResponse(loanId, action);
        });
    });
};


// --- Initialization ---

document.addEventListener('DOMContentLoaded', fetchDashboardData);