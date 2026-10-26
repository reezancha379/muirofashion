import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  KeyRound, 
  ShieldAlert, 
  X, 
  Check, 
  ArrowRight, 
  RotateCcw, 
  ShieldCheck, 
  Smartphone, 
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import { api, getLastVerifyError } from '@/lib/api';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [authMethod, setAuthMethod] = useState<'pin' | 'authenticator'>('pin');
  const [credentialInput, setCredentialInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Secure Reset Passcode form states
  const [showResetView, setShowResetView] = useState(false);
  const [resetAuthCode, setResetAuthCode] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(false);
      setErrorMessage('');
      setCredentialInput('');
      setShowResetView(false);
      setResetAuthCode('');
      setNewPinInput('');
      setConfirmPinInput('');
      setResetSuccessMessage(null);
      setIsVerifying(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Login Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const entered = credentialInput.trim();
    if (!entered) {
      setError(true);
      setErrorMessage('Please enter your admin credentials.');
      return;
    }

    setIsVerifying(true);
    setError(false);
    setErrorMessage('');

    try {
      const isValid = await api.verifyAdminCredential(entered);
      if (isValid) {
        sessionStorage.setItem('muiro_admin_auth', 'true');
        setError(false);
        setCredentialInput('');
        onSuccess();
      } else {
        setError(true);
        // Prefer the server's concrete reason (lockout countdown, clock-skew
        // hint) over the generic fallback.
        setErrorMessage(
          getLastVerifyError() ||
            'Authentication failed. Incorrect passcode or invalid 6-digit authenticator code.'
        );
      }
    } catch {
      setError(true);
      setErrorMessage('Verification failed. Please check your credentials and try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Secure Passcode Reset: requires authenticating with the paired phone authenticator code
  const handleSecureReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const authCode = resetAuthCode.trim();
    const newPin = newPinInput.trim();
    const confirmPin = confirmPinInput.trim();

    if (!authCode) {
      setError(true);
      setErrorMessage('Please enter the 6-digit verification code from your Authenticator app.');
      return;
    }

    if (newPin.length < 4) {
      setError(true);
      setErrorMessage('New passcode must be at least 4 characters long.');
      return;
    }

    if (newPin !== confirmPin) {
      setError(true);
      setErrorMessage('New passcode and confirmation do not match.');
      return;
    }

    setIsVerifying(true);
    setError(false);
    setErrorMessage('');

    try {
      await api.resetAdminPinWithAuth(authCode, newPin);
      setResetSuccessMessage('Identity verified. Your new passcode has been updated.');
      setTimeout(() => {
        sessionStorage.setItem('muiro_admin_auth', 'true');
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setError(true);
      setErrorMessage(err.message || 'Verification failed. The authenticator code provided is invalid.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#181512]/75 backdrop-blur-sm flex items-center justify-center p-4 font-casual animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-[#e8e2dc] shadow-2xl animate-in zoom-in-95 duration-200 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#e8e2dc] mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#181512] text-white flex items-center justify-center shadow-xs">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#181512] tracking-tight">Owner Access</h3>
              <p className="text-xs text-[#6e6761]">MUIRO Studio &amp; Editorial Controls</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#6e6761] hover:text-[#181512] rounded-full hover:bg-[#f4efe9] transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {resetSuccessMessage && (
          <div className="mb-5 p-3.5 rounded-xl bg-[#181512] text-white text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{resetSuccessMessage}</span>
          </div>
        )}

        {!showResetView ? (
          <div>
            {/* Method Tabs: Passcode vs Authenticator App */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-[#f4efe9] rounded-xl mb-5 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('pin');
                  setError(false);
                  setErrorMessage('');
                }}
                className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  authMethod === 'pin'
                    ? 'bg-white text-[#181512] shadow-xs'
                    : 'text-[#6e6761] hover:text-[#181512]'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Passcode (PIN)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMethod('authenticator');
                  setError(false);
                  setErrorMessage('');
                }}
                className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  authMethod === 'authenticator'
                    ? 'bg-white text-[#181512] shadow-xs'
                    : 'text-[#6e6761] hover:text-[#181512]'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Authenticator</span>
              </button>
            </div>

            {/* Authentication Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#181512]">
                    {authMethod === 'pin' ? 'Admin Passcode' : '6-Digit Authenticator Code'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowResetView(true);
                      setError(false);
                      setErrorMessage('');
                    }}
                    className="text-xs text-[#6e6761] hover:text-[#181512] font-semibold underline underline-offset-2 cursor-pointer"
                  >
                    Forgot Passcode?
                  </button>
                </div>

                <div className="relative">
                  {authMethod === 'pin' ? (
                    <KeyRound className="w-4 h-4 text-[#6e6761] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  ) : (
                    <Smartphone className="w-4 h-4 text-[#6e6761] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  )}
                  <input
                    type={authMethod === 'pin' ? 'password' : 'text'}
                    autoFocus
                    value={credentialInput}
                    onChange={(e) => {
                      setCredentialInput(e.target.value);
                      if (error) {
                        setError(false);
                        setErrorMessage('');
                      }
                    }}
                    placeholder={authMethod === 'pin' ? 'Enter your passcode' : 'Enter 6-digit rolling code'}
                    maxLength={authMethod === 'pin' ? 32 : 12}
                    className="w-full pl-10 pr-4 py-3 bg-[#fcfbf9] border border-[#e8e2dc] rounded-xl text-sm font-mono tracking-widest text-[#181512] focus:outline-none focus:border-[#181512] focus:bg-white transition"
                  />
                </div>

                {error ? (
                  <div className="mt-2.5">
                    <p className="text-xs text-rose-600 font-semibold flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                      <span>{errorMessage || 'Authentication failed.'}</span>
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-[#6e6761] mt-2 leading-relaxed">
                    {authMethod === 'pin'
                      ? 'Enter your studio passcode. Once inside, you can scan the QR code in Security settings to pair your phone authenticator and change your PIN when needed.'
                      : 'Open your authenticator app on your phone and enter the active 6-digit code.'}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 px-4 rounded-xl border border-[#e8e2dc] text-[#181512] text-xs font-bold uppercase tracking-wider hover:bg-[#f4efe9] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifying}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#181512] hover:bg-black text-white text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-98 disabled:opacity-75"
                >
                  {isVerifying ? (
                    <span>Verifying...</span>
                  ) : (
                    <>
                      <span>{authMethod === 'pin' ? 'Unlock Admin' : 'Verify & Unlock'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Secure Passcode Reset: strictly requires phone authenticator identity verification */
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#fcfbf9] border border-[#e8e2dc] space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#181512]">
                <RotateCcw className="w-4 h-4" />
                <span>Identity-Verified Passcode Reset</span>
              </div>
              <p className="text-xs text-[#6e6761] leading-relaxed">
                To prevent unauthorized access, you must verify your identity with the active 6-digit code from your paired authenticator app on your phone.
              </p>
            </div>

            <form onSubmit={handleSecureReset} className="space-y-3.5">
              {/* Authenticator Code Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#181512] mb-1.5">
                  6-Digit Authenticator Code *
                </label>
                <div className="relative">
                  <Smartphone className="w-4 h-4 text-[#6e6761] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    autoFocus
                    value={resetAuthCode}
                    onChange={e => {
                      setResetAuthCode(e.target.value);
                      if (error) setError(false);
                    }}
                    placeholder="Enter code from Authenticator app"
                    maxLength={32}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#fcfbf9] border border-[#e8e2dc] rounded-xl text-sm font-mono tracking-widest text-[#181512] focus:outline-none focus:border-[#181512]"
                  />
                </div>
              </div>

              {/* New Passcode */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#181512] mb-1.5">
                  New Passcode (min 4 characters) *
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#6e6761] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={newPinInput}
                    onChange={e => {
                      setNewPinInput(e.target.value);
                      if (error) setError(false);
                    }}
                    placeholder="Create new passcode"
                    className="w-full pl-10 pr-4 py-2.5 bg-[#fcfbf9] border border-[#e8e2dc] rounded-xl text-sm font-mono tracking-widest text-[#181512] focus:outline-none focus:border-[#181512]"
                  />
                </div>
              </div>

              {/* Confirm Passcode */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#181512] mb-1.5">
                  Confirm New Passcode *
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#6e6761] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={confirmPinInput}
                    onChange={e => {
                      setConfirmPinInput(e.target.value);
                      if (error) setError(false);
                    }}
                    placeholder="Confirm new passcode"
                    className="w-full pl-10 pr-4 py-2.5 bg-[#fcfbf9] border border-[#e8e2dc] rounded-xl text-sm font-mono tracking-widest text-[#181512] focus:outline-none focus:border-[#181512]"
                  />
                </div>
              </div>

              {error && (
                <p className="text-xs text-rose-600 font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span>{errorMessage || 'Verification failed.'}</span>
                </p>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetView(false);
                    setError(false);
                    setErrorMessage('');
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl border border-[#e8e2dc] text-[#181512] text-xs font-bold uppercase tracking-wider hover:bg-[#f4efe9] transition cursor-pointer"
                >
                  Back to Login
                </button>
                <button
                  type="submit"
                  disabled={isVerifying}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-[#181512] hover:bg-black text-white text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer disabled:opacity-75"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isVerifying ? 'Verifying...' : 'Verify & Reset'}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
