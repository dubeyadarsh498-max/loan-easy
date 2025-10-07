// dashboard.js
import { fetchData, getToken, removeToken } from './api.js';

const userNameEl = document.getElementById('user-name');
const userBalanceEl = document.getElementById('user-balance');
const borrowerSection = document.getElementById('borrower-dashboard');
const lenderSection = document.getElementById('lender-dashboard');
const loansBorrowedList = document.getElementById('loans-borrowed-list');
const loansLentList = document.getElementById('loans-lent-list');
const noBorrowedLoans = document.getElementById('no-borrowed-loans');
const noLentLoans = document.getElementById('no-lent-loans');
const userRole = localStorage.getItem('userRole');


// Helper to create a loan summary list item
const createLoanSummary = (loan, isLent = false) => {
    const div = document.createElement('div');
    div.className = 'loan-summary-item';

    if (isLent) {
        // This is simplified as your backend doesn't have an 'investments' table, 
        // it uses `matchedWith` and `status` on the LoanRequest.
        // We assume we fetch loans where `matchedWith` is the user's ID.
        div.innerHTML = `
            <p>
                **₹<span data-lent-amount>${loan.amount.toLocaleString()}</span>** lent to Loan #<span data-lent-loan-id>${loan._id.slice(-6).toUpperCase()}</span> 
                <span class="loan-status loan-status-${loan.status}">${loan.status}</span>
            </p>
            <p class="secondary-info">Borrower: ${loan.borrower.name} | Rate: ${loan.interestRate}%</p>
        `;
    } else {
        // Borrowed loan
        const statusClass = loan.status === 'accepted' ? 'success' : loan.status === 'matched' ? 'pending' : 'default';
        
        // Match acceptance/rejection
        let actionButtons = '';
        if (loan.status === 'matched' && loan.borrower.toString() === localStorage.getItem('userId')) {
             actionButtons = `
                <button data-loan-id="${loan._id}" data-action="accept" class="button-link small-button">Accept Offer</button>
                <button data-loan-id="${loan._id}" data-action="reject" class="button-link small-button secondary-button">Reject Offer</button>
             `;
        }

        div.innerHTML = `
            <p>
                **₹<span data-borrowed-amount>${loan.amount.toLocaleString()}</span>** requested 
                <span class="loan-status loan-status-${statusClass}">${loan.status}</span>
            </p>
            <p class="secondary-info">Lender: ${loan.matchedWith?.name || 'N/A'}</p>
            <div class="action-group">${actionButtons}</div>
        `;
    }
    return div;
};

// --- Data Fetching and Initialization ---

const fetchDashboardData = async () => {
    // In a real app, you'd have an endpoint like /api/user/dashboard that returns all data
    // Here we need to get user info and then their loans/investments.

    const userId = localStorage.getItem('userId');
    if (!userId) {
        removeToken();
        window.location.href = 'login.html';
        return;
    }

    // SIMPLIFIED: Assume we fetch all loans and filter them client-side based on the role
    // In a production app, the server should return only relevant data.
    const allLoansResult = await fetchData('/loans/requests/all'); // Assuming a new endpoint for all user loans

    // For now, let's manually fetch loans that the user is the borrower of
    const borrowedResult = await fetchData(`/loans/borrower/${userId}`); 
    // And loans the user is the matched lender for
    const lentResult = await fetchData(`/loans/lender/${userId}`); 
    
    // Fallback if the user is not found or endpoint is missing
    userNameEl.textContent = localStorage.getItem('userName') || 'User'; 
    userBalanceEl.textContent = (100000).toLocaleString(); // Hardcoded balance, replace with real data

    // --- RENDER BORROWER DATA ---
    loansBorrowedList.innerHTML = '';
    if (userRole === 'borrower') {
        lenderSection.classList.add('hidden');
        if (borrowedResult.success && borrowedResult.data.length > 0) {
            borrowedResult.data.forEach(loan => loansBorrowedList.appendChild(createLoanSummary(loan, false)));
            noBorrowedLoans.classList.add('hidden');
            setupLoanResponseListeners();
        } else {
            noBorrowedLoans.classList.remove('hidden');
        }
    }

    // --- RENDER LENDER DATA ---
    if (userRole === 'lender') {
        borrowerSection.classList.add('hidden');
        if (lentResult.success && lentResult.data.length > 0) {
            lentResult.data.forEach(loan => loansLentList.appendChild(createLoanSummary(loan, true)));
            noLentLoans.classList.add('hidden');
            // Lender acceptance listeners here if applicable
        } else {
            noLentLoans.classList.remove('hidden');
        }
    }
};

// --- Event Listeners ---

const setupLoanResponseListeners = () => {
    loansBorrowedList.querySelectorAll('.action-group button').forEach(button => {
        button.addEventListener('click', async (e) => {
            const loanId = e.target.getAttribute('data-loan-id');
            const action = e.target.getAttribute('data-action');
            
            const result = await fetchData(`/loans/${loanId}/respond`, {
                method: 'POST',
                body: JSON.stringify({ action })
            });

            if (result.success) {
                alert(`Loan ${action}ed successfully!`);
                fetchDashboardData(); // Refresh data
            } else {
                alert(result.msg || `Failed to ${action} loan.`);
            }
        });
    });
};

const setupLogout = () => {
    document.getElementById('logout-button').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.clear();
        window.location.href = 'index.html';
    });
};


// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    if (!getToken()) {
        window.location.href = 'login.html';
        return;
    }
    fetchDashboardData();
    setupLogout(); 
});
