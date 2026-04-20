import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, CheckCircle, Mail, ArrowLeft } from 'lucide-react';
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

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [devResetLink, setDevResetLink] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await axios.post('/api/v1/auth/forgot-password', {
        email: email.toLowerCase().trim(),
      });
      setMaskedEmail(response.data.email_masked || email);
      setDevResetLink(response.data.dev_reset_link || '');
      setSubmitted(true);
    } catch (err) {
      const msg = err.response && err.response.data && (err.response.data.detail || err.response.data.message);
      setError(msg || 'Failed to process request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSubmitted(false);
    setEmail('');
    setDevResetLink('');
  };

  if (submitted) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4" style={canvasStyle}>
        <div className="absolute top-0 right-0 w-[500px] h-[500px] pointer-events-none" style={blob1Style}></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] pointer-events-none" style={blob2Style}></div>

        <div className="relative z-10 w-full max-w-md bg-white/80 backdrop-blur-xl rounded-2xl border border-white shadow-[0_8px_30px_rgba(168,85,247,0.08)] p-8 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="font-serif text-[28px] tracking-tight text-gray-900">Check your email</h1>
          <p className="text-gray-600 text-sm">If an account exists, we have sent a reset link to:</p>
          <div className="rounded-xl p-3 border" style={{
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.06) 0%, rgba(236, 72, 153, 0.04) 100%)',
            borderColor: 'rgba(168, 85, 247, 0.2)'
          }}>
            <p className="font-medium text-brand-700 text-sm">{maskedEmail}</p>
          </div>
          {devResetLink ? (
            <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 text-left">
              <p className="text-xs font-semibold text-brand-700 mb-2 uppercase tracking-wider">Dev mode</p>
              <p className="text-xs text-brand-600 mb-3">No email service configured. Open the reset link directly:</p>
              <a href={devResetLink} className="block w-full text-center text-white py-2.5 rounded-xl font-medium text-sm transition-all hover:-translate-y-0.5"
                style={gradientBtnStyle}>
                Open reset link
              </a>
            </div>
          ) : null}
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
            <p className="text-xs font-medium text-amber-700">Link expires in 15 minutes</p>
          </div>
          <button onClick={resetForm} className="text-brand-600 hover:text-brand-700 font-medium text-sm transition-colors">
            Try a different email
          </button>
          <button onClick={() => navigate('/login')} className="w-full py-2.5 text-white rounded-xl text-sm font-medium transition-all hover:-translate-y-0.5"
            style={gradientBtnStyle}>
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4" style={canvasStyle}>
      <div className="absolute top-0 right-0 w-[500px] h-[500px] pointer-events-none" style={blob1Style}></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] pointer-events-none" style={blob2Style}></div>

      <div className="relative z-10 w-full max-w-md bg-white/80 backdrop-blur-xl rounded-2xl border border-white shadow-[0_8px_30px_rgba(168,85,247,0.08)] p-8">
        <div className="mb-6">
          <button onClick={() => navigate('/login')} className="flex items-center gap-2 text-brand-600 hover:text-brand-700 font-medium mb-4 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to login
          </button>
          <h1 className="font-serif text-[28px] tracking-tight text-gray-900 mb-2">Forgot password?</h1>
          <p className="text-gray-600 text-sm">Enter your email and we'll send you a link to reset your password.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5 uppercase tracking-wider">Email address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                required
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
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-gray-100 text-center text-sm text-gray-600">
          Remember your password? <Link to="/login" className="text-brand-600 hover:text-brand-700 font-medium transition-colors">Sign in</Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;