import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export const ProtectedRoute: React.FC = () => {
  const { fbUser, loading } = useAuth()
  if (loading) return <div className="container py-5">Loading...</div>
  if (!fbUser) return <Navigate to="/login" replace />
  return <Outlet />
}

export const RoleRoute: React.FC<{ allow: Array<string> }> = ({ allow }) => {
  const { profile, loading } = useAuth()
  if (loading) return <div className="container py-5">Loading...</div>
  if (!profile) return <Navigate to="/login" replace />
  if (!allow.includes(profile.department) && profile.role !== 'admin') {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}
