import { create } from 'zustand'
import { authApi } from '../lib/api'

export const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('geply_token'),
  loading: true,

  login: async (email, password) => {
    const { data } = await authApi.login({ email, password })
    localStorage.setItem('geply_token', data.access_token)
    set({ token: data.access_token })
    // Fetch user profile
    const { data: user } = await authApi.me()
    set({ user, loading: false })
    return user
  },

  register: async (email, password, full_name, company) => {
    await authApi.register({ email, password, full_name, company })
  },

  logout: () => {
    localStorage.removeItem('geply_token')
    set({ user: null, token: null })
    window.location.href = '/login'
  },

  loadUser: async () => {
    const token = localStorage.getItem('geply_token')
    if (!token) {
      set({ loading: false })
      return
    }
    try {
      const { data } = await authApi.me()
      set({ user: data, loading: false })
    } catch {
      localStorage.removeItem('geply_token')
      set({ user: null, token: null, loading: false })
    }
  },
}))
