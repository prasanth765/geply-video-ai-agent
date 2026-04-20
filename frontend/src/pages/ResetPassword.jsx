import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AlertCircle, CheckCircle, Lock, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';

const canvasStyle = {
  background: 'radial-gradient(ellipse 80% 60% at 20% 0%, #F5F0FF 0%, #FAFAFB 45%, #FFFFFF 100%)'
};
const blob1Style = {
  background: 'radial-gradient(circle, rgba(168, 85, 247, 0.18) 0%, transparent 70%)',
  filter: 'blur(60px)', transform: 'translate(30%, -30%)'
};
const blob2Style = {
  background: 'radial-gradient(circle, rgba(236, 72, 153, 0.12) 0%, transparent 70%)',
  filter: 'blur(60px)', transform: 'translate(-30%, 30%)'
};
const gradientBtnStyle = {
  background: 'linear-gradient(135deg, #A855F7 0%, #EC4899 100%)',
  boxShadow: '0 4px 14px rgba(168, 85, 247, 0.35)'
};

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await axios.post('/api/v1/auth/reset-password', {
        token,
        new_password: newPassword,
      });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      const msg = err.response && err.response.data && (err.response.data.detail || err.response.data.message);
      setError(msg || 'Failed to reset password. The link may be invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  // Shared shell
  const Shell = ({ children }) => (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4" style={canvasStyle}>
      <div className="absolute top-0 right-0 w-[500px] h-[500px] pointer-events-none" style={blob1Style}></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] pointer-events-none" style={blob2Style}></div>
      <div className="relative z-10 w-full max-w-md bg-white/80 backdrop-blur-xl rounded-2xl border border-white shadow-[0_8px_30px_rgba(168,85,247,0.08)] p-8">
        {children}
      </div>
    </div>
  );

  if (!token) {
    return (
      <Shell>
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="font-serif text-2xl tracking-tight text-gray-900">Invalid reset link</h1>
          <p className="text-gray-600 text-sm">This link is missing a token. Please request a new one.</p>
          <Link to="/forgot-password" className="block w-full py-2.5 text-white rounded-xl text-sm font-medium transition-all hover:-translate-y-0.5"
            style={gradientBtnStyle}>
            Request new reset link
          </Link>
          <Link to="/login" className="block text-sm text-brand-600 hover:text-brand-700 transition-colors">Back to login</Link>
        </div>
      </Shell>
    );
  }

  if (success) {
    return (
      <Shell>
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="font-serif text-2xl tracking-tight text-gray-900">Password updated</h1>
          <p className="text-gray-600 text-sm">Your password has been reset. Redirecting to login...</p>
          <Link to="/login" className="block w-full py-2.5 text-white rounded-xl text-sm font-medium transition-all hover:-translate-y-0.5"
            style={gradientBtnStyle}>
            Go to login now
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-6">
        <h1 className="font-serif text-[28px] tracking-tight text-gray-900 mb-2">Reset password</h1>
        <p className="text-gray-600 text-sm">Choose a new password for your account.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5 uppercase tracking-wider">New password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-600 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5 uppercase tracking-wider">Confirm password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
              required
              minLength={8}
            />
          </div>
        </div>

        {error ? (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 text-white rounded-xl text-sm font-medium transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
          style={gradientBtnStyle}
        >
          {loading ? 'Resetting...' : 'Reset password'}
        </button>

        <div className="text-center text-sm text-gray-600 pt-2">
          <Link to="/login" className="text-brand-600 hover:text-brand-700 font-medium transition-colors">Back to login</Link>
        </div>
      </form>
    </Shell>
  );
};

export default ResetPassword;