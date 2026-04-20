import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../hooks/useAuth'
import { Briefcase } from 'lucide-react'

const canvasStyle = {
  background: 'radial-gradient(ellipse 80% 60% at 20% 0%, #F5F0FF 0%, #FAFAFB 45%, #FFFFFF 100%)'
}
const blob1Style = {
  background: 'radial-gradient(circle, rgba(168, 85, 247, 0.18) 0%, transparent 70%)',
  filter: 'blur(60px)', transform: 'translate(30%, -30%)'
}
const blob2Style = {
  background: 'radial-gradient(circle, rgba(236, 72, 153, 0.12) 0%, transparent 70%)',
  filter: 'blur(60px)', transform: 'translate(-30%, 30%)'
}
const gradientBtnStyle = {
  background: 'linear-gradient(135deg, #A855F7 0%, #EC4899 100%)',
  boxShadow: '0 4px 14px rgba(168, 85, 247, 0.35)'
}

export default function Login() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [company, setCompany] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, register } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'register') {
        await register(email, password, fullName, company)
        setMode('login')
        setError('')
      }
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4" style={canvasStyle}>
      <div className="absolute top-0 right-0 w-[500px] h-[500px] pointer-events-none" style={blob1Style}></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] pointer-events-none" style={blob2Style}></div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={gradientBtnStyle}>
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <h1 className="font-serif text-[32px] tracking-tight text-gray-900">Geply</h1>
          </div>
          <p className="text-gray-500 text-sm">AI-powered interview platform</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white shadow-[0_8px_30px_rgba(168,85,247,0.08)] p-6">
          <div className="flex mb-5 bg-gray-100/80 rounded-lg p-0.5">
            {['login', 'register'].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-1.5 text-sm rounded-md transition-all ${
                  mode === m ? 'bg-white font-medium shadow-sm text-gray-900' : 'text-gray-500'
                }`}
              >
                {m === 'login' ? 'Sign in' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <>
                <input
                  type="text"
                  placeholder="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                />
                <input
                  type="text"
                  placeholder="Company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                />
              </>
            )}

            <input
              type="email"
              placeholder="you@gep.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
            />

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Password
                </label>
                {mode === 'login' && (
                  <Link
                    to="/forgot-password"
                    className="text-xs text-brand-600 hover:text-brand-700 font-medium transition-colors"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <input
                type="password"
                placeholder="Password (min 8 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
              />
            </div>

            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-white rounded-xl text-sm font-medium transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
              style={gradientBtnStyle}
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">Powered by Geply</p>
      </div>
    </div>
  )
}