import React, { useState } from 'react'
import { Card, Button, Form } from 'react-bootstrap'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { useAuth, type Department } from '../context/AuthContext'
import { ToastContainer, toast } from 'react-toastify'

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
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      <ToastContainer position="top-right" />
      <Card style={{ width: 450 }}>
        <Card.Body>
          <Card.Title className="mb-3">Create Account</Card.Title>
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

            <Button type="submit" disabled={loading} className="w-100" variant="primary">
              {loading ? 'Creating Account...' : 'Sign Up'}
            </Button>

            <div className="text-center mt-3">
              <small>
                Already have an account? <Link to="/login">Sign in</Link>
              </small>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  )
}

export default Signup
