import React, { useState } from 'react'
import { Card, Button, Form } from 'react-bootstrap'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { useAuth, type Department } from '../context/AuthContext'
import { ToastContainer, toast } from 'react-toastify'
import Logo from '../components/Logo'

const Signup: React.FC = () => {
  const { signup, fbUser } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [department, setDepartment] = useState<Department>('marketing')
  const [role, setRole] = useState<'user' | 'admin'>('user')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  if (fbUser) return <Navigate to="/" replace />

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await signup(email, password, displayName, department, role)
      toast.success('Account created successfully!')
      navigate('/')
    } catch (e: any) {
      toast.error(e.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #2B3E7E 0%, #4A5F9F 100%)' }}>
      <ToastContainer position="top-right" />
      <Card className="custom-card scale-in" style={{ width: 480, border: 'none' }}>
        <Card.Body className="p-4">
          <div className="text-center mb-4">
            <Logo size="large" showText={false} className="justify-center" />
          </div>
          <h3 className="mb-2 text-center" style={{ color: 'var(--primary-navy)', fontWeight: 700 }}>Create Account</h3>
          <p className="text-center mb-4" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Join OB Management System</p>
          <Form onSubmit={onSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Full Name</Form.Label>
              <Form.Control 
                type="text" 
                value={displayName} 
                onChange={(e) => setDisplayName(e.target.value)} 
                placeholder="Jane Doe"
                required 
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="jane@radio.co"
                required 
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <Form.Control 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="Minimum 6 characters"
                required 
                minLength={6}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Department</Form.Label>
              <Form.Select 
                value={department} 
                onChange={(e) => setDepartment(e.target.value as Department)}
                required
              >
                <option value="marketing">Marketing</option>
                <option value="programming">Programming</option>
                <option value="technical">Technical</option>
                <option value="admin">Admin</option>
                <option value="finance">Finance</option>
                <option value="systemAdmin">System Admin</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Role</Form.Label>
              <Form.Select 
                value={role} 
                onChange={(e) => setRole(e.target.value as 'user' | 'admin')}
                required
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </Form.Select>
            </Form.Group>

            <Button type="submit" disabled={loading} className="w-100" variant="primary" size="lg">
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>

            <div className="text-center mt-3">
              <small style={{ color: 'var(--text-secondary)' }}>
                Already have an account? <Link to="/login" style={{ color: 'var(--primary-orange)', fontWeight: 600 }}>Sign in</Link>
              </small>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  )
}

export default Signup
