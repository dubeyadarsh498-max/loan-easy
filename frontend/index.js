// index.js
import { fetchData, getToken, removeToken } from './api.js';
import { showFlash } from './auth.js'; 

const loanListContainer = document.getElementById('loan-list');
const noLoansMessage = document.getElementById('no-loans-message');
const authLinksContainer = document.getElementById('auth-links');
const userRole = localStorage.getItem('userRole'); 

// --- UI Management ---

const updateHeaderLinks = () => {
    const isLoggedIn = !!getToken();
    const userRole = localStorage.getItem('userRole');

    // Hide all links first
    authLinksContainer.querySelectorAll('[data-auth-link]').forEach(a => a.classList.add('hidden'));

    if (isLoggedIn) {
        document.querySelector('[data-auth-link="dashboard"]').classList.remove('hidden');
        document.querySelector('[data-auth-link="profile"]').classList.remove('hidden');
        document.querySelector('[data-auth-link="logout"]').classList.remove('hidden');
        
        if (userRole === 'admin') {
            document.querySelector('[data-auth-link="admin"]').classList.remove('hidden');
        }
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
    card.setAttribute('data-remaining', loan.amount); 
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
    if (!getToken()) {
        loanListContainer.innerHTML = `<p class="empty-state">Please login to view open loan requests.</p>`;
        noLoansMessage.classList.add('hidden');
        return;
    }
    
    if (userRole !== 'lender') {
        loanListContainer.innerHTML = `<p class="empty-state">Only lenders can view open loan requests for funding.</p>`;
        noLoansMessage.classList.add('hidden');
        return;
    }

    const result = await fetchData('/loans/open');

    loanListContainer.innerHTML = ''; 

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
            
            const result = await fetchData(`/loans/${loanId}/interest`, {
                method: 'POST',
                body: JSON.stringify({})
            });

            if (result.success) {
                showFlash('Interest expressed! Waiting for borrower acceptance.', 'success');
                fetchAndDisplayLoans(); 
            } else {
                showFlash(result.msg || 'Failed to express interest.', 'error');
            }
        });
    });
};

const setupLogout = () => {
    document.querySelector('[data-auth-link="logout"]').addEventListener('click', (e) => {
        e.preventDefault();
        // IMPORTANT: Use the exported utility
        removeToken(); 
        window.location.href = 'index.html';
    });
};


// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    updateHeaderLinks();
    fetchAndDisplayLoans();
    setupLogout(); 
});