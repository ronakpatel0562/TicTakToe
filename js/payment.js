// Payment Gateway System (UPI, Card, Bank, Crypto & Razorpay Sandbox)
class PaymentGateway {
    constructor() {
        this.modal = document.getElementById('payment-gateway-modal');
        this.closeBtn = document.getElementById('pg-close-btn');
        this.balanceValEl = document.getElementById('pg-balance-val');
        this.amountBtns = document.querySelectorAll('.pg-amt-btn');
        this.customAmtInput = document.getElementById('pg-custom-amt');
        this.methodCards = document.querySelectorAll('.pg-method-card');
        this.detailsPanel = document.getElementById('pg-details-panel');
        this.payBtn = document.getElementById('pg-pay-btn');

        // Views
        this.depositView = document.getElementById('pg-deposit-view');
        this.processingView = document.getElementById('pg-processing-view');
        this.receiptView = document.getElementById('pg-receipt-view');
        this.returnBtn = document.getElementById('pg-return-btn');

        // Navigation Tabs
        this.tabBtns = document.querySelectorAll('.pg-tab-btn');
        this.tabPanes = document.querySelectorAll('.pg-tab-pane');

        // Withdrawal Elements
        this.withdrawAmtInput = document.getElementById('pg-withdraw-amt');
        this.withdrawDestInput = document.getElementById('pg-withdraw-dest');
        this.withdrawBtn = document.getElementById('pg-withdraw-btn');
        this.withdrawMethodSelect = document.getElementById('pg-withdraw-method');

        // Transactions & Settings
        this.historyList = document.getElementById('pg-history-list');
        this.settingRzpKey = document.getElementById('pg-setting-rzp-key');
        this.settingMode = document.getElementById('pg-setting-mode');
        this.saveSettingsBtn = document.getElementById('pg-save-settings-btn');

        // State
        this.amount = 50.00;
        this.method = 'upi'; // 'upi', 'card', 'bank', 'crypto'
        this.mode = localStorage.getItem('arcade_gateway_mode') || 'simulator';
        this.rzpKey = localStorage.getItem('arcade_rzp_key') || '';

        this.init();
    }

    init() {
        this.bindEvents();
        this.loadSettings();
        this.renderMethodDetails();
    }

    loadSettings() {
        if (this.settingRzpKey) this.settingRzpKey.value = this.rzpKey;
        if (this.settingMode) this.settingMode.value = this.mode;
    }

    bindEvents() {
        // Close modal
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => {
                window.soundEngine.playClick();
                this.close();
            });
        }

        // Close on backdrop click
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) this.close();
            });
        }

        // Navigation Tabs
        this.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                window.soundEngine.playClick();
                const tab = btn.dataset.tab;

                this.tabBtns.forEach(b => b.classList.remove('active'));
                this.tabPanes.forEach(p => p.classList.remove('active'));

                btn.classList.add('active');
                const pane = document.getElementById(`pg-tab-${tab}`);
                if (pane) pane.classList.add('active');

                if (tab === 'transactions') {
                    this.renderTransactions();
                }
            });
        });

        // Preset Amounts
        this.amountBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                window.soundEngine.playClick();
                this.amountBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.amount = parseFloat(btn.dataset.amount);
                if (this.customAmtInput) this.customAmtInput.value = '';
                this.updatePayButton();
            });
        });

        // Custom Amount Input
        if (this.customAmtInput) {
            this.customAmtInput.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val > 0) {
                    this.amount = val;
                    this.amountBtns.forEach(b => b.classList.remove('active'));
                    this.updatePayButton();
                }
            });
        }

        // Payment Methods Selection
        this.methodCards.forEach(card => {
            card.addEventListener('click', () => {
                window.soundEngine.playClick();
                this.methodCards.forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                this.method = card.dataset.method;
                this.renderMethodDetails();
            });
        });

        // Proceed to Pay
        if (this.payBtn) {
            this.payBtn.addEventListener('click', () => {
                this.processDeposit();
            });
        }

        // Return to Game from Receipt
        if (this.returnBtn) {
            this.returnBtn.addEventListener('click', () => {
                window.soundEngine.playClick();
                this.close();
            });
        }

        // Withdrawal Submit
        if (this.withdrawBtn) {
            this.withdrawBtn.addEventListener('click', () => {
                this.processWithdrawal();
            });
        }

        // Save Settings
        if (this.saveSettingsBtn) {
            this.saveSettingsBtn.addEventListener('click', () => {
                this.rzpKey = this.settingRzpKey ? this.settingRzpKey.value.trim() : '';
                this.mode = this.settingMode ? this.settingMode.value : 'simulator';

                localStorage.setItem('arcade_rzp_key', this.rzpKey);
                localStorage.setItem('arcade_gateway_mode', this.mode);

                if (window.showToast) {
                    window.showToast('Gateway Settings Saved ⚙️', `Payment mode set to: ${this.mode.toUpperCase()}`, 'success');
                }
            });
        }

        // Global trigger listeners (Aviator, Color Prediction, Navbar)
        document.addEventListener('click', (e) => {
            const trigger = e.target.closest('.open-payment-gateway-btn, #nav-add-funds-btn, #aviator-open-gateway-btn, #cp-open-gateway-btn');
            if (trigger) {
                e.preventDefault();
                window.soundEngine.playClick();
                const preAmt = trigger.dataset.amount ? parseFloat(trigger.dataset.amount) : null;
                this.open(preAmt);
            }
        });
    }

    open(preselectedAmount = null) {
        if (!this.modal) return;
        this.updateBalanceUI();

        if (preselectedAmount) {
            this.amount = preselectedAmount;
            if (this.customAmtInput) this.customAmtInput.value = preselectedAmount;
            this.amountBtns.forEach(b => b.classList.remove('active'));
        }

        this.updatePayButton();
        this.resetViews();

        this.modal.classList.add('active');
    }

    close() {
        if (!this.modal) return;
        this.modal.classList.remove('active');
        this.resetViews();
    }

    resetViews() {
        if (this.depositView) this.depositView.style.display = 'flex';
        if (this.processingView) this.processingView.classList.remove('active');
        if (this.receiptView) this.receiptView.classList.remove('active');
    }

    updateBalanceUI() {
        if (this.balanceValEl && window.arcadeWallet) {
            this.balanceValEl.textContent = window.arcadeWallet.format();
        }
    }

    updatePayButton() {
        if (this.payBtn) {
            this.payBtn.innerHTML = `
                <i class="fa-solid fa-lock"></i>
                <span>Pay $${this.amount.toFixed(2)} Securely</span>
            `;
        }
    }

    renderMethodDetails() {
        if (!this.detailsPanel) return;

        if (this.method === 'upi') {
            this.detailsPanel.innerHTML = `
                <div class="pg-upi-qr-box">
                    <span style="font-size:0.8rem; font-weight:700; color:var(--text-muted);">Scan QR with any UPI App</span>
                    <div class="pg-qr-frame">
                        <svg viewBox="0 0 100 100" width="100%" height="100%">
                            <!-- High contrast simulated QR matrix -->
                            <rect width="100" height="100" fill="#ffffff"/>
                            <rect x="8" y="8" width="28" height="28" fill="#111827"/>
                            <rect x="12" y="12" width="20" height="20" fill="#ffffff"/>
                            <rect x="16" y="16" width="12" height="12" fill="#111827"/>
                            <rect x="64" y="8" width="28" height="28" fill="#111827"/>
                            <rect x="68" y="12" width="20" height="20" fill="#ffffff"/>
                            <rect x="72" y="16" width="12" height="12" fill="#111827"/>
                            <rect x="8" y="64" width="28" height="28" fill="#111827"/>
                            <rect x="12" y="68" width="20" height="20" fill="#ffffff"/>
                            <rect x="16" y="72" width="12" height="12" fill="#111827"/>
                            <!-- Data modules -->
                            <rect x="42" y="12" width="6" height="6" fill="#111827"/>
                            <rect x="52" y="16" width="6" height="12" fill="#111827"/>
                            <rect x="42" y="28" width="14" height="6" fill="#111827"/>
                            <rect x="12" y="44" width="8" height="8" fill="#111827"/>
                            <rect x="26" y="44" width="10" height="6" fill="#111827"/>
                            <rect x="42" y="42" width="16" height="16" fill="#10b981"/>
                            <rect x="64" y="44" width="8" height="12" fill="#111827"/>
                            <rect x="78" y="42" width="14" height="6" fill="#111827"/>
                            <rect x="44" y="66" width="12" height="8" fill="#111827"/>
                            <rect x="62" y="64" width="8" height="14" fill="#111827"/>
                            <rect x="76" y="68" width="16" height="8" fill="#111827"/>
                            <rect x="44" y="80" width="10" height="12" fill="#111827"/>
                            <rect x="60" y="82" width="18" height="10" fill="#111827"/>
                        </svg>
                    </div>
                    <div class="pg-upi-id-row">
                        <span>UPI ID: <strong>arcadex.pay@okaxis</strong></span>
                        <button type="button" class="pg-copy-btn" id="pg-copy-upi"><i class="fa-solid fa-copy"></i> Copy</button>
                    </div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">
                        Supported: <span style="color:var(--text-primary); font-weight:700;">Google Pay • PhonePe • Paytm • BHIM</span>
                    </div>
                </div>
            `;

            const copyBtn = document.getElementById('pg-copy-upi');
            if (copyBtn) {
                copyBtn.addEventListener('click', () => {
                    navigator.clipboard.writeText('arcadex.pay@okaxis');
                    if (window.showToast) window.showToast('Copied! 📋', 'UPI ID copied to clipboard', 'info');
                });
            }
        } else if (this.method === 'card') {
            this.detailsPanel.innerHTML = `
                <div class="pg-card-form">
                    <div class="pg-input-box">
                        <i class="fa-regular fa-credit-card"></i>
                        <input type="text" class="pg-input" placeholder="Card Number (4000 1234 5678 9010)" maxlength="19" value="4532 8921 4402 7891">
                    </div>
                    <div class="pg-form-row">
                        <div class="pg-input-box" style="flex:1;">
                            <input type="text" class="pg-input" placeholder="MM / YY" maxlength="5" value="12/28">
                        </div>
                        <div class="pg-input-box" style="flex:1;">
                            <input type="password" class="pg-input" placeholder="CVV" maxlength="3" value="782">
                        </div>
                    </div>
                    <div class="pg-input-box">
                        <input type="text" class="pg-input" placeholder="Cardholder Name" value="PRO ARCADE GAMER">
                    </div>
                </div>
            `;
        } else if (this.method === 'bank') {
            this.detailsPanel.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:0.6rem;">
                    <label style="font-size:0.8rem; font-weight:700; color:var(--text-secondary);">Select Net Banking Portal:</label>
                    <select class="pg-input" style="background:var(--bg-input); border:1px solid var(--border-color); padding:0.6rem 0.8rem; border-radius:var(--radius-md);">
                        <option>State Bank of India (SBI)</option>
                        <option>HDFC Bank</option>
                        <option>ICICI Bank</option>
                        <option>Axis Bank</option>
                        <option>Kotak Mahindra Bank</option>
                        <option>Punjab National Bank</option>
                    </select>
                    <small style="color:var(--text-muted); font-size:0.75rem;">You will be redirected to your bank's secure authorization page.</small>
                </div>
            `;
        } else if (this.method === 'crypto') {
            this.detailsPanel.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; gap:0.6rem; text-align:center;">
                    <span style="font-size:0.82rem; font-weight:800; color:#ec4899;">USDT (Tether) • TRC-20 Network</span>
                    <div class="pg-upi-id-row" style="font-size:0.75rem;">
                        <span>TXk9q8DLeqPmZ37uLkpL6Q8...</span>
                        <button type="button" class="pg-copy-btn" id="pg-copy-crypto"><i class="fa-solid fa-copy"></i></button>
                    </div>
                    <small style="color:var(--text-muted); font-size:0.75rem;">Instant automated credit after 1 network block confirmation.</small>
                </div>
            `;

            const copyCrypto = document.getElementById('pg-copy-crypto');
            if (copyCrypto) {
                copyCrypto.addEventListener('click', () => {
                    navigator.clipboard.writeText('TXk9q8DLeqPmZ37uLkpL6Q8x3N89K');
                    if (window.showToast) window.showToast('Copied! 📋', 'TRC-20 Address copied', 'info');
                });
            }
        }
    }

    processDeposit() {
        if (this.amount <= 0 || isNaN(this.amount)) {
            if (window.showToast) window.showToast('Invalid Amount', 'Enter a valid amount to deposit', 'error');
            return;
        }

        window.soundEngine.playClick();

        // Check if real Razorpay mode is configured
        if (this.mode === 'razorpay' && this.rzpKey && window.Razorpay) {
            try {
                const options = {
                    key: this.rzpKey,
                    amount: Math.round(this.amount * 100), // paise
                    currency: 'INR',
                    name: 'Arcade X Gaming Suite',
                    description: 'Deposit for Aviator & Color Prediction',
                    handler: (response) => {
                        this.completeDeposit(response.razorpay_payment_id || `RZP_${Date.now()}`, 'Razorpay Gateway');
                    },
                    prefill: {
                        name: 'Player One',
                        email: 'player@arcadex.pro',
                        contact: '9999999999'
                    },
                    theme: {
                        color: '#3b82f6'
                    }
                };
                const rzp = new window.Razorpay(options);
                rzp.open();
                return;
            } catch (err) {
                console.warn('Razorpay checkout error, falling back to simulator', err);
            }
        }

        // Default: Full Interactive Simulator
        if (this.depositView) this.depositView.style.display = 'none';
        if (this.processingView) this.processingView.classList.add('active');

        const procTitle = document.getElementById('pg-proc-title');
        const procDesc = document.getElementById('pg-proc-desc');

        if (procTitle) procTitle.textContent = 'Connecting to Payment Gateway...';
        if (procDesc) procDesc.textContent = `Authorizing $${this.amount.toFixed(2)} via ${this.method.toUpperCase()} secure channel...`;

        setTimeout(() => {
            if (procTitle) procTitle.textContent = 'Verifying Transaction with Bank...';
            if (procDesc) procDesc.textContent = 'Waiting for automated settlement confirmation...';
        }, 1100);

        setTimeout(() => {
            const txnId = 'TXN_' + Math.floor(100000000 + Math.random() * 900000000);
            this.completeDeposit(txnId, `${this.method.toUpperCase()} Gateway`);
        }, 2200);
    }

    completeDeposit(txnId, methodTitle) {
        if (this.processingView) this.processingView.classList.remove('active');

        // Add to wallet
        if (window.arcadeWallet) {
            window.arcadeWallet.add(this.amount);
            window.arcadeWallet.addTransaction({
                id: txnId,
                type: 'deposit',
                title: 'Deposit Funds',
                method: methodTitle,
                amount: this.amount,
                status: 'COMPLETED'
            });
        }

        // Celebrate
        if (window.soundEngine) window.soundEngine.playAviatorCashout();
        if (window.triggerConfetti) window.triggerConfetti();

        // Populate Receipt
        const rAmt = document.getElementById('pg-receipt-amt');
        const rTxn = document.getElementById('pg-receipt-txn');
        const rMethod = document.getElementById('pg-receipt-method');
        const rTime = document.getElementById('pg-receipt-time');

        if (rAmt) rAmt.textContent = `+$${this.amount.toFixed(2)}`;
        if (rTxn) rTxn.textContent = txnId;
        if (rMethod) rMethod.textContent = methodTitle;
        if (rTime) rTime.textContent = new Date().toLocaleTimeString();

        if (this.receiptView) this.receiptView.classList.add('active');
        this.updateBalanceUI();

        if (window.showToast) {
            window.showToast('Payment Successful! 💳', `Successfully credited +$${this.amount.toFixed(2)} to your arcade wallet!`, 'success');
        }
    }

    processWithdrawal() {
        const amt = parseFloat(this.withdrawAmtInput.value);
        const dest = this.withdrawDestInput ? this.withdrawDestInput.value.trim() : '';

        if (isNaN(amt) || amt <= 0) {
            if (window.showToast) window.showToast('Invalid Amount', 'Enter a valid amount to withdraw', 'error');
            return;
        }

        if (!dest) {
            if (window.showToast) window.showToast('Destination Required', 'Please enter your UPI ID or Bank Account Number', 'warning');
            return;
        }

        if (!window.arcadeWallet || amt > window.arcadeWallet.getBalance()) {
            if (window.showToast) window.showToast('Insufficient Balance', 'Withdrawal amount exceeds available wallet balance', 'error');
            return;
        }

        window.soundEngine.playClick();
        window.arcadeWallet.deduct(amt);

        const txnId = 'WTH_' + Math.floor(100000000 + Math.random() * 900000000);
        const method = this.withdrawMethodSelect ? this.withdrawMethodSelect.value : 'UPI';

        window.arcadeWallet.addTransaction({
            id: txnId,
            type: 'withdraw',
            title: `Withdrawal (${dest})`,
            method: method,
            amount: amt,
            status: 'PROCESSING'
        });

        this.updateBalanceUI();
        if (this.withdrawAmtInput) this.withdrawAmtInput.value = '';
        if (this.withdrawDestInput) this.withdrawDestInput.value = '';

        if (window.showToast) {
            window.showToast('Withdrawal Submitted! 💸', `Request of $${amt.toFixed(2)} to ${dest} initiated. Funds will reflect within 15 minutes!`, 'success');
        }

        // Switch to history tab to see processing state
        const histBtn = document.querySelector('.pg-tab-btn[data-tab="transactions"]');
        if (histBtn) histBtn.click();
    }

    renderTransactions() {
        if (!this.historyList || !window.arcadeWallet) return;
        const txns = window.arcadeWallet.getTransactions();

        if (txns.length === 0) {
            this.historyList.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:2rem;">No transactions yet.</div>`;
            return;
        }

        this.historyList.innerHTML = txns.map(t => `
            <div class="pg-txn-item">
                <div class="pg-txn-left">
                    <div class="pg-txn-icon ${t.type}">
                        <i class="fa-solid ${t.type === 'deposit' ? 'fa-arrow-down-left' : 'fa-arrow-up-right'}"></i>
                    </div>
                    <div class="pg-txn-desc">
                        <span class="pg-txn-title">${t.title || (t.type === 'deposit' ? 'Add Funds' : 'Payout')}</span>
                        <span class="pg-txn-time">${t.id} • ${t.time}</span>
                    </div>
                </div>
                <div class="pg-txn-right">
                    <span class="pg-txn-amount ${t.type === 'deposit' ? 'pos' : 'neg'}">
                        ${t.type === 'deposit' ? '+' : '-'}$${parseFloat(t.amount).toFixed(2)}
                    </span>
                    <span class="pg-txn-status" style="color: ${t.status === 'PROCESSING' ? 'var(--color-warning)' : 'var(--color-success)'}">
                        ${t.status}
                    </span>
                </div>
            </div>
        `).join('');
    }
}

// Global instance
window.addEventListener('DOMContentLoaded', () => {
    window.paymentGateway = new PaymentGateway();
});

