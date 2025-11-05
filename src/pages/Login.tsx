import React, { useState } from 'react'
import { Card, Button, Form } from 'react-bootstrap'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ToastContainer, toast } from 'react-toastify'
import Logo from '../components/Logo'

const Login: React.FC = () => {
  const { login, fbUser } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  if (fbUser) return <Navigate to="/" replace />

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (e: any) {
      toast.error(e.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #2B3E7E 0%, #4A5F9F 100%)' }}>
      <ToastContainer position="top-right" />
      <Card className="custom-card scale-in" style={{ width: 420, border: 'none' }}>
        <Card.Body className="p-4">
          <div className="text-center mb-4">
            <Logo size="large" className="justify-center" showText={false} />
          </div>
          <h3 className="mb-2 text-center" style={{ color: 'var(--primary-navy)', fontWeight: 700 }}>Welcome Back</h3>
          <p className="text-center mb-4" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Sign in to OB Management System</p>
          <Form onSubmit={onSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Email Address</Form.Label>
              <Form.Control type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" required />
            </Form.Group>
            <Form.Group className="mb-4">
              <Form.Label>Password</Form.Label>
              <Form.Control type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required />
            </Form.Group>
            <Button type="submit" disabled={loading} className="w-100" variant="primary" size="lg">
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </div>
  )
}

export default Login
