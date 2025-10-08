// index.js
import { fetchData } from './api.js';
import { showFlash } from './auth.js';

const loanList = document.getElementById('loan-list');
const noLoansMessage = document.getElementById('no-loans-message');
const userId = localStorage.getItem('userId');

const getStatusBadge = (status) => {
    let className = 'status-badge';
    if (status === 'open') className += ' status-open';
    else if (status === 'matched') className += ' status-matched';
    else if (status === 'accepted') className += ' status-accepted';
    else className += ' status-rejected';
    
    return `<span class="${className}">${status.toUpperCase().replace('_', ' ')}</span>`;
}

const renderLoanItem = (loan) => {
    // Note: The backend should filter for verified KYC, but this is a final frontend check
    if (!loan.borrower.kyc.verified) {
        return ''; 
    }
    
    return `
        <div class="card loan-item">
            <h3>Loan Request #${loan._id.substring(0, 8)}</h3>
            <p><strong>Amount:</strong> ₹${loan.amount.toLocaleString()}</p>
            <p><strong>Max Interest Rate:</strong> ${loan.interestRate}%</p>
            <p><strong>Period:</strong> ${loan.periodMonths} months</p>
            <p><strong>Status:</strong> ${getStatusBadge(loan.status)}</p>

            <form class="fund-form" data-loan-id="${loan._id}">
                <button type="submit" class="btn-success">Fund/Match Loan</button>
            </form>
        </div>
    `;
};

const handleFund = async (e) => {
    e.preventDefault();
    const loanId = e.target.closest('.fund-form').getAttribute('data-loan-id');

    if (!confirm('Are you sure you want to match/fund this loan? This marks the loan as matched.')) {
        return;
    }

    const result = await fetchData(`/loans/${loanId}/interest`, {
        method: 'POST',
        body: JSON.stringify({})
    });

    if (result.success) {
        showFlash('Loan matched successfully! Borrower will be notified for final acceptance.', 'success');
        fetchOpenLoans(); // Refresh the list
    } else {
        showFlash(result.msg || 'Failed to match loan. Check if you are a verified lender.', 'error');
    }
};

const fetchOpenLoans = async () => {
    const role = localStorage.getItem('userRole');
    
    // Only proceed if the user is a lender
    if (role !== 'lender') {
        noLoansMessage.classList.remove('hidden');
        return;
    }
    
    const result = await fetchData('/loans/open', { method: 'GET' });

    if (result.success) {
        const loans = result.json || [];
        
        // Filter out loans created by the current user (you can't lend to yourself)
        const filteredLoans = loans.filter(loan => 
            loan.borrower._id !== userId // userId comes from local storage
        );
        
        if (filteredLoans.length === 0) {
            noLoansMessage.classList.remove('hidden');
            loanList.innerHTML = '';
        } else {
            noLoansMessage.classList.add('hidden');
            loanList.innerHTML = filteredLoans.map(renderLoanItem).join('');

            document.querySelectorAll('.fund-form').forEach(form => {
                form.addEventListener('submit', handleFund);
            });
        }

    } else {
        showFlash(result.msg || 'Failed to fetch loan requests.', 'error');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    fetchOpenLoans();
});
axios.get("http://localhost:5000/api/users")
    