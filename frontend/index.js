// index.js
import { fetchData, getToken } from './api.js';

const loanListContainer = document.getElementById('loan-list');
const noLoansMessage = document.getElementById('no-loans-message');
const authLinksContainer = document.getElementById('auth-links');
const userRole = localStorage.getItem('userRole'); // Get role from local storage

// --- UI Management ---

const updateHeaderLinks = () => {
    const isLoggedIn = !!getToken();
    
    // Hide all links first
    authLinksContainer.querySelectorAll('a').forEach(a => a.classList.add('hidden'));

    if (isLoggedIn) {
        document.querySelector('[data-auth-link="dashboard"]').classList.remove('hidden');
        document.querySelector('[data-auth-link="logout"]').classList.remove('hidden');
    } else {
        document.querySelector('[data-auth-link="login"]').classList.remove('hidden');
        document.querySelector('[data-auth-link="register"]').classList.remove('hidden');
    }
};

const createLoanCard = (loan) => {
    const isLender = userRole === 'lender';
    
    const card = document.createElement('article');
    card.className = 'loan-item';
    card.setAttribute('data-loan-id', loan._id);
    card.setAttribute('data-amount', loan.amount);
    card.setAttribute('data-remaining', loan.amount); // Assuming remaining is full amount for open loans
    card.setAttribute('data-interest-rate', loan.interestRate);
    card.setAttribute('data-term-months', loan.periodMonths);

    const shortId = loan._id.slice(-6).toUpperCase();

    card.innerHTML = `
        <h3>Loan #${shortId}</h3>
        <p><strong>Amount:</strong> ₹<span data-loan-field="amount">${loan.amount.toLocaleString()}</span></p>
        <p><strong>Remaining:</strong> ₹<span data-loan-field="remaining">${loan.amount.toLocaleString()}</span></p>
        <p><strong>Rate/Term:</strong> <span data-loan-field="interest">${loan.interestRate}</span>% for <span data-loan-field="term">${loan.periodMonths}</span> months</p>
        <p><strong>Borrower:</strong> ${loan.borrower.name}</p>

        <form action="/api/loans/${loan._id}/interest" method="post" class="fund-form" data-form-role="lender" ${isLender ? '' : 'style="display:none;"'}>
            <label for="fund-amount-${shortId}">Fund Amount:</label>
            <input type="number" id="fund-amount-${shortId}" name="amount" step="0.01" required min="0.01" max="${loan.amount}" placeholder="e.g., 1000">
            <button type="submit" data-loan-id="${loan._id}">Fund</button>
        </form>
    `;

    return card;
};

// --- Data Fetching and Initialization ---

const fetchAndDisplayLoans = async () => {
    if (userRole !== 'lender') {
        // Only lenders are allowed to view open loans on this endpoint, 
        // but we'll still run the code to display dummy/local data for non-lenders
        // In a real app, this should fetch public data or redirect.
        if (loanListContainer.children.length === 0) {
            noLoansMessage.classList.remove('hidden');
        }
        return;
    }

    const result = await fetchData('/loans/open');

    loanListContainer.innerHTML = ''; // Clear previous content

    if (result.success && result.data.length > 0) {
        result.data.forEach(loan => {
            loanListContainer.appendChild(createLoanCard(loan));
        });
        noLoansMessage.classList.add('hidden');
        setupFundingListeners();
    } else {
        noLoansMessage.classList.remove('hidden');
    }
};

// --- Event Listeners ---

const setupFundingListeners = () => {
    loanListContainer.querySelectorAll('.fund-form').forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const loanId = e.target.querySelector('button').getAttribute('data-loan-id');
            // In your backend, the /:id/interest route does NOT take an amount, 
            // it just matches the lender. We'll stick to the backend definition.
            
            const result = await fetchData(`/loans/${loanId}/interest`, {
                method: 'POST',
                body: JSON.stringify({}) // Empty body as per backend
            });

            if (result.success) {
                alert('Interest expressed! Waiting for borrower acceptance.');
                // Optional: Reload the list or update the card status
                fetchAndDisplayLoans(); 
            } else {
                alert(result.msg || 'Failed to express interest.');
            }
        });
    });
};

const setupLogout = () => {
    document.querySelector('[data-auth-link="logout"]').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.clear(); // Clears token and userRole
        window.location.href = 'index.html';
    });
};


// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    updateHeaderLinks();
    fetchAndDisplayLoans();
    setupLogout(); 
});