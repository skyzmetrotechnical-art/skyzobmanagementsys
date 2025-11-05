import React, { useState } from 'react'
import { Card, Button, Form } from 'react-bootstrap'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ToastContainer, toast } from 'react-toastify'

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
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      <ToastContainer position="top-right" />
      <Card style={{ width: 400 }}>
        <Card.Body>
          <Card.Title className="mb-3">Sign in</Card.Title>
          <Form onSubmit={onSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <Form.Control type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Form.Group>
            <Button type="submit" disabled={loading} className="w-100">
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </div>
  )
}

export default Login
