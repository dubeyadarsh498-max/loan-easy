// dashboard.js
import { fetchData } from './api.js';
import { showFlash } from './auth.js';

const userId = localStorage.getItem('userId');
const userRole = localStorage.getItem('userRole');
const kycStatusDisplay = document.getElementById('kyc-verification-status');
const borrowerSection = document.getElementById('borrower-dashboard');
const lenderSection = document.getElementById('lender-dashboard');
const borrowerTableBody = document.querySelector('#borrower-loans-table tbody');
const lenderTableBody = document.querySelector('#lender-loans-table tbody');
const noBorrowerLoans = document.getElementById('no-borrower-loans');
const noLenderLoans = document.getElementById('no-lender-loans');

if (!userId || !userRole) {
    window.location.href = 'login.html';
}

const getStatusBadge = (status) => {
    let className = 'status-badge';
    if (status === 'open') className += ' status-open';
    else if (status === 'matched') className += ' status-matched';
    else if (status === 'accepted') className += ' status-accepted';
    else className += ' status-rejected';
    
    return `<span class="${className}">${status.toUpperCase().replace('_', ' ')}</span>`;
}

const handleResponse = async (loanId, action) => {
    const result = await fetchData(`/loans/${loanId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action: action })
    });

    if (result.success) {
        showFlash(`Loan request ${action}ed successfully.`, 'success');
        fetchUserLoans(); // Refresh dashboard data
    } else {
        showFlash(result.msg || 'Failed to update loan status.', 'error');
    }
};

// --- Borrower Loan Rendering ---
const renderBorrowerLoan = (loan) => {
    let actions = '';
    
    if (loan.status === 'matched' && loan.borrowerAccepted === false) {
        actions = `
            <button class="btn-success" onclick="handleResponse('${loan._id}', 'accept')">Accept</button>
            <button class="btn-danger" onclick="handleResponse('${loan._id}', 'reject')">Reject</button>
        `;
    } else if (loan.status === 'accepted') {
        actions = `<span class="status-badge status-success">Completed</span>`;
    } else {
         actions = `<span class="status-badge status-secondary">Pending Lender</span>`;
    }

    const lenderName = loan.matchedWith ? loan.matchedWith.name : 'N/A';
    
    return `
        <tr>
            <td>#${loan._id.substring(0, 8)}</td>
            <td>₹${loan.amount.toLocaleString()}</td>
            <td>${loan.interestRate}% / ${loan.periodMonths} mo</td>
            <td>${lenderName}</td>
            <td>${getStatusBadge(loan.status)}</td>
            <td>${actions}</td>
        </tr>
    `;
};

// --- Lender Loan Rendering ---
const renderLenderLoan = (loan) => {
    let actions = '';
    
    if (loan.status === 'matched' && loan.lenderAccepted === false) {
         actions = `
            <button class="btn-success" onclick="handleResponse('${loan._id}', 'accept')">Accept</button>
            <button class="btn-danger" onclick="handleResponse('${loan._id}', 'reject')">Reject</button>
        `;
    } else if (loan.status === 'accepted') {
        actions = `<span class="status-badge status-success">Completed</span>`;
    } else {
        actions = `<span class="status-badge status-secondary">Pending Borrower</span>`;
    }
    
    const borrowerName = loan.borrower ? loan.borrower.name : 'N/A';
    
    return `
        <tr>
            <td>#${loan._id.substring(0, 8)}</td>
            <td>₹${loan.amount.toLocaleString()}</td>
            <td>${loan.interestRate}% / ${loan.periodMonths} mo</td>
            <td>${borrowerName}</td>
            <td>${getStatusBadge(loan.status)}</td>
            <td>${actions}</td>
        </tr>
    `;
};


// --- Fetch Data ---
const fetchUserLoans = async () => {
    if (userRole === 'borrower') {
        borrowerSection.classList.remove('hidden');
        const result = await fetchData(`/loans/borrower/${userId}`);
        
        if (result.success && result.json) {
            borrowerTableBody.innerHTML = result.json.map(renderBorrowerLoan).join('');
            if (result.json.length === 0) noBorrowerLoans.classList.remove('hidden');
            else noBorrowerLoans.classList.add('hidden');
        } else {
            showFlash('Failed to load borrower loans.', 'error');
        }
    }

    if (userRole === 'lender') {
        lenderSection.classList.remove('hidden');
        const result = await fetchData(`/loans/lender/${userId}`);
        
        if (result.success && result.json) {
            lenderTableBody.innerHTML = result.json.map(renderLenderLoan).join('');
            if (result.json.length === 0) noLenderLoans.classList.remove('hidden');
            else noLenderLoans.classList.add('hidden');
        } else {
            showFlash('Failed to load lent loans.', 'error');
        }
    }
};

const fetchKYCStatus = async () => {
    const result = await fetchData(`/user/profile`);
    
    if (result.success && result.email) {
        const isVerified = result.kyc?.verified;
        
        kycStatusDisplay.textContent = isVerified ? 'Verified' : 'Under Review / Unverified';
        kycStatusDisplay.style.color = isVerified ? 'var(--color-success)' : 'var(--color-danger)';
        
    } else {
        kycStatusDisplay.textContent = 'Error fetching status';
    }
};


document.addEventListener('DOMContentLoaded', () => {
    // Expose handleResponse globally so it can be called from inline HTML (onclick)
    window.handleResponse = handleResponse; 
    
    fetchKYCStatus();
    fetchUserLoans();
});