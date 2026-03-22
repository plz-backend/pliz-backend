import { Router } from 'express';
import { addBankAccount } from '../controllers/add_bank_account';
import { resolveBankAccount } from '../controllers/resolve_bank_account';
import { getBankAccounts } from '../controllers/get_bank_accounts';
import { getBanks } from '../controllers/get_banks';
import { getWithdrawals } from '../controllers/get_withdrawals';
import { requestWithdrawal } from '../controllers/request_withdrawal';
import { authenticate } from '../../auth/middleware/auth/auth';
import { updateBankAccount } from '../controllers/update_bank_account';
import { deleteBankAccount } from '../controllers/delete_bank_account';
import { checkAccountStatus } from '../../auth/middleware/auth/account_status.middleware';

const router = Router();

// ============================================
// BANK ACCOUNT MANAGEMENT
// ============================================

/**
 * @route   GET /api/withdrawals/banks
 * @desc    Get list of Nigerian banks
 * @access  Public
 */
router.get('/banks', getBanks);

/**
 * @route   POST /api/withdrawals/resolve-account
 * @desc    Resolve account name via Paystack (does not save)
 * @access  Private
 */
router.post('/resolve-account', authenticate, resolveBankAccount);

/**
 * @route   POST /api/withdrawals/bank-accounts
 * @desc    Add a new bank account
 * @access  Private
 */
router.post('/bank-accounts', authenticate, checkAccountStatus, addBankAccount);

/**
 * @route   GET /api/withdrawals/bank-accounts
 * @desc    Get user's bank accounts
 * @access  Private
 */
router.get('/bank-accounts', authenticate, getBankAccounts);

/**
 * @route   PUT /api/withdrawals/bank-accounts/:id
 * @desc    Set bank account as default
 * @access  Private
 */
router.put('/bank-accounts/:id', authenticate, updateBankAccount);

/**
 * @route   DELETE /api/withdrawals/bank-accounts/:id
 * @desc    Delete a bank account
 * @access  Private
 */
router.delete('/bank-accounts/:id', authenticate, deleteBankAccount);

// ============================================
// WITHDRAWAL MANAGEMENT
// ============================================

/**
 * @route   GET /api/withdrawals
 * @desc    Get user's withdrawal history
 * @access  Private
 */
router.get('/', authenticate, getWithdrawals);

/**
 * @route   POST /api/withdrawals/request
 * @desc    Request withdrawal of funds from a funded beg
 * @access  Private
 */
router.post('/request', authenticate, checkAccountStatus, requestWithdrawal);

export default router;
