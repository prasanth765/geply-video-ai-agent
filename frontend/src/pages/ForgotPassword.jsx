import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, CheckCircle, Mail, ArrowLeft } from 'lucide-react';
import axios from 'axios';

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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8 text-center space-y-4">
          <div className="inline-block bg-green-100 p-4 rounded-full">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Check Your Email</h1>
          <p className="text-gray-600">If an account exists, we have sent a reset link to:</p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="font-medium text-gray-800">{maskedEmail}</p>
          </div>
          {devResetLink ? (
            <div className="bg-purple-50 border border-purple-300 rounded-lg p-4 text-left">
              <p className="text-sm font-semibold text-purple-900 mb-2">Dev mode</p>
              <p className="text-xs text-purple-700 mb-3">No email service configured. Open the reset link directly:</p>
              <a href={devResetLink} className="block w-full text-center bg-purple-600 text-white py-2 rounded-md hover:bg-purple-700 font-medium text-sm">
                Open reset link
              </a>
            </div>
          ) : null}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm font-medium text-yellow-800">Link expires in 15 minutes</p>
          </div>
          <button onClick={resetForm} className="text-blue-600 hover:text-blue-700 font-medium text-sm">
            Try a different email
          </button>
          <button onClick={() => navigate('/login')} className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium">
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
        <div className="mb-8">
          <button onClick={() => navigate('/login')} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </button>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Forgot Password?</h1>
          <p className="text-gray-600">Enter your email and we will send you a link to reset your password.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                required
              />
            </div>
          </div>

          {error ? (
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200 text-center text-sm text-gray-600">
          Remember your password? <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">Sign in</Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;