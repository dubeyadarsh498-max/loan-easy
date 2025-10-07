// admin.js
import { fetchData, getToken } from './api.js';
import { showFlash } from './auth.js';

const userRole = localStorage.getItem('userRole');

const kycQueueBody = document.getElementById('kyc-queue-body');
const allLoansBody = document.getElementById('all-loans-body');


// --- Authorization Check ---
const checkAdminAccess = () => {
    if (!getToken() || userRole !== 'admin') {
        showFlash('Access Denied: You must be logged in as an Admin.', 'error'); 
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
        return false;
    }
    return true;
};

// --- KYC Verification Logic ---

const handleVerifyUser = async (userId) => {
    const result = await fetchData(`/admin/kyc/${userId}/verify`, {
        method: 'POST'
    });

    if (result.success) {
        showFlash(`User ${userId.slice(-6).toUpperCase()} KYC successfully verified.`, 'success');
        fetchAdminData(); 
    } else {
        showFlash(result.msg || 'Failed to verify KYC.', 'error');
    }
};

const createKycRow = (user) => {
    const tr = document.createElement('tr');
    const isVerified = user.kyc.verified;
    const docCount = [user.kyc.pan, user.kyc.aadhaar, user.kyc.idProof].filter(d => d).length;

    tr.innerHTML = `
        <td>${user.name} (${user.email})</td>
        <td>${user.role}</td>
        <td>
            ${docCount} Documents Submitted 
            ${docCount > 0 ? `<a href="/uploads/${user.kyc.idProof}" target="_blank">(View ID Proof)</a>` : ''}
        </td>
        <td><span class="user-status ${isVerified ? 'verified' : 'unverified'}">
            ${isVerified ? 'Verified' : 'Pending'}
        </span></td>
        <td>
            ${!isVerified && docCount > 0 
                ? `<button class="button-link small-button verify-btn" data-user-id="${user._id}">Verify KYC</button>` 
                : 'N/A'}
        </td>
    `;
    return tr;
};

const setupKycListeners = () => {
    kycQueueBody.querySelectorAll('.verify-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const userId = e.target.getAttribute('data-user-id');
            if (confirm(`Are you sure you want to verify KYC for user ${userId.slice(-6)}?`)) { 
                handleVerifyUser(userId);
            }
        });
    });
};

// --- Loan Request List Logic ---

const createLoanRow = (loan) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${loan._id.slice(-6).toUpperCase()}</td>
        <td>₹${loan.amount.toLocaleString()}</td>
        <td>${loan.interestRate}%</td>
        <td>${loan.borrower.name} (${loan.borrower.role})</td>
        <td>${loan.matchedWith ? loan.matchedWith.name : 'None'}</td>
        <td><span class="loan-status">${loan.status}</span></td>
    `;
    return tr;
};

// --- Main Data Fetcher ---

const fetchAdminData = async () => {
    // Note: The /admin/requests endpoint now returns loan data populated with user KYC info
    const loansResult = await fetchData('/admin/requests');
    
    // 1. Display Loan Requests
    allLoansBody.innerHTML = '';
    if (loansResult.success && loansResult.data.length > 0) {
        loansResult.data.forEach(loan => allLoansBody.appendChild(createLoanRow(loan)));
    } else {
        allLoansBody.innerHTML = `<tr><td colspan="6" class="empty-state-small">No loan requests found.</td></tr>`;
    }

    // 2. Filter for KYC Queue 
    // This is a simplified way to extract unique users from the loan data
    const usersInvolved = loansResult.success 
        ? loansResult.data.reduce((acc, loan) => {
            // Add borrower
            if (!acc.find(u => u._id === loan.borrower._id)) acc.push(loan.borrower);
            // Add lender
            if (loan.matchedWith && !acc.find(u => u._id === loan.matchedWith._id)) acc.push(loan.matchedWith);
            return acc;
        }, [])
        : [];
    
    const unverifiedUsers = usersInvolved.filter(user => user && !user.kyc.verified && user.kyc.idProof);

    kycQueueBody.innerHTML = '';
    if (unverifiedUsers.length > 0) {
        unverifiedUsers.forEach(user => kycQueueBody.appendChild(createKycRow(user)));
        setupKycListeners();
    } else {
        kycQueueBody.innerHTML = `<tr><td colspan="5" class="empty-state-small">All involved users are verified or have not submitted required documents.</td></tr>`;
    }
};


// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    if (checkAdminAccess()) {
        fetchAdminData();
    }
});