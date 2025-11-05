import React, { useEffect, useState } from 'react'
import { ref, get } from 'firebase/database'
import { db } from '../firebase'
import { Col, Row, Table, Badge, Button, ProgressBar } from 'react-bootstrap'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

interface Request {
  id: string
  title?: string
  eventName?: string
  status: string
  currentStep: string
  steps?: any
  createdAt: any
  updatedAt?: any
}

const Dashboard: React.FC = () => {
  const [pending, setPending] = useState(0)
  const [approved, setApproved] = useState(0)
  const [rejected, setRejected] = useState(0)
  const [total, setTotal] = useState(0)
  const [recentRequests, setRecentRequests] = useState<Request[]>([])
  const [userPendingCount, setUserPendingCount] = useState(0)
  const { profile } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      const requestsRef = ref(db, 'requests')
      const snap = await get(requestsRef)
      if (snap.exists()) {
        const requests = snap.val()
        const values = Object.entries(requests).map(([id, data]: [string, any]) => ({
          id,
          ...data
        })) as Request[]
        
        setPending(values.filter((r) => r.status === 'pending').length)
        setApproved(values.filter((r) => r.status === 'approved').length)
        setRejected(values.filter((r) => r.status === 'rejected').length)
        setTotal(values.length)
        
        // Get recent 5 requests sorted by created/updated date
        const sorted = values.sort((a, b) => {
          const dateA = a.updatedAt || a.createdAt || 0
          const dateB = b.updatedAt || b.createdAt || 0
          return (typeof dateB === 'number' ? dateB : 0) - (typeof dateA === 'number' ? dateA : 0)
        }).slice(0, 5)
        setRecentRequests(sorted)
        
        // Count pending requests for user's department
        const userDeptPending = values.filter((r) => 
          r.status === 'pending' && r.currentStep === profile?.department
        ).length
        setUserPendingCount(userDeptPending)
      }
    }
    load()
  }, [profile?.department])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge bg="success">Approved</Badge>
      case 'pending':
        return <Badge bg="warning" text="dark">Pending</Badge>
      case 'rejected':
        return <Badge bg="danger">Denied</Badge>
      default:
        return <Badge bg="secondary">{status}</Badge>
    }
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A'
    const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp)
    return date.toLocaleString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  const calculateProgress = (request: Request) => {
    if (!request.steps) return { current: 0, total: 6 }
    const deptOrder = ['programming', 'technical', 'admin', 'finance', 'final']
    let completedSteps = 1 // marketing is always completed when request is created
    
    for (const dept of deptOrder) {
      if (request.steps[dept]?.status === 'approved') {
        completedSteps++
      } else {
        break
      }
    }
    
    return { current: completedSteps, total: 6 }
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header d-flex justify-content-between align-items-center">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Welcome back, {profile?.displayName || 'John Doe'}! Here's your OB requests overview.
          </p>
        </div>
        {profile?.department === 'marketing' && (
          <Button variant="primary" onClick={() => navigate('/requests/new')} style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>
            + Add New Request
          </Button>
        )}
      </div>

      {/* Pending Attention Banner - Only show if user has pending requests in their department */}
      {userPendingCount > 0 && (
        <div className="alert-banner mb-4">
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Pending Requests
            </h3>
            <p style={{ fontSize: '1rem', marginBottom: '1rem', opacity: 0.95 }}>
              You have {userPendingCount} request{userPendingCount !== 1 ? 's' : ''} needing attention.
            </p>
            <Button 
              variant="light" 
              onClick={() => navigate('/requests')}
              style={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                color: 'var(--primary-orange)',
                fontWeight: 600,
                border: 'none'
              }}
            >
              View Pending
            </Button>
          </div>
        </div>
      )}

      {/* Stats Cards - Compact version */}
      <Row className="g-3 mb-4">
        <Col xs={6} lg={3}>
          <div className="stats-card" style={{ padding: '1.25rem' }}>
            <div className="stats-card-header" style={{ marginBottom: '0.75rem' }}>
              <div>
                <h6 className="stats-card-title" style={{ fontSize: '0.8rem' }}>Total Requests</h6>
              </div>
              <div className="stats-card-icon primary" style={{ width: '48px', height: '48px', fontSize: '1.25rem' }}>
                📋
              </div>
            </div>
            <div className="stats-card-value" style={{ fontSize: '2rem' }}>{total}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              All time
            </div>
          </div>
        </Col>

        <Col xs={6} lg={3}>
          <div className="stats-card" style={{ padding: '1.25rem' }}>
            <div className="stats-card-header" style={{ marginBottom: '0.75rem' }}>
              <div>
                <h6 className="stats-card-title" style={{ fontSize: '0.8rem' }}>Approved</h6>
              </div>
              <div className="stats-card-icon success" style={{ width: '48px', height: '48px', fontSize: '1.25rem' }}>
                ✓
              </div>
            </div>
            <div className="stats-card-value" style={{ fontSize: '2rem' }}>{approved}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--success-green)', marginTop: '0.25rem', fontWeight: 600 }}>
              {total > 0 ? `${Math.round((approved / total) * 100)}%` : '0%'} success rate
            </div>
          </div>
        </Col>

        <Col xs={6} lg={3}>
          <div className="stats-card" style={{ padding: '1.25rem' }}>
            <div className="stats-card-header" style={{ marginBottom: '0.75rem' }}>
              <div>
                <h6 className="stats-card-title" style={{ fontSize: '0.8rem' }}>Pending</h6>
              </div>
              <div className="stats-card-icon warning" style={{ width: '48px', height: '48px', fontSize: '1.25rem' }}>
                ⏳
              </div>
            </div>
            <div className="stats-card-value" style={{ fontSize: '2rem' }}>{pending}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Awaiting approval
            </div>
          </div>
        </Col>

        <Col xs={6} lg={3}>
          <div className="stats-card" style={{ padding: '1.25rem' }}>
            <div className="stats-card-header" style={{ marginBottom: '0.75rem' }}>
              <div>
                <h6 className="stats-card-title" style={{ fontSize: '0.8rem' }}>Denied</h6>
              </div>
              <div className="stats-card-icon danger" style={{ width: '48px', height: '48px', fontSize: '1.25rem' }}>
                ✗
              </div>
            </div>
            <div className="stats-card-value" style={{ fontSize: '2rem' }}>{rejected}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--danger-red)', marginTop: '0.25rem', fontWeight: 600 }}>
              {total > 0 ? `${Math.round((rejected / total) * 100)}%` : '0%'} rejection rate
            </div>
          </div>
        </Col>
      </Row>

      {/* Recent Requests Table */}
      <div className="custom-card">
        <div className="card-body" style={{ padding: '1.75rem' }}>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h3 style={{ color: 'var(--primary-navy)', fontWeight: 700, fontSize: '1.5rem', margin: 0 }}>
              Recent Requests
            </h3>
            <Button 
              variant="link" 
              onClick={() => navigate('/requests')}
              style={{ 
                color: 'var(--primary-orange)', 
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.95rem'
              }}
            >
              View All →
            </Button>
          </div>
          
          <Table hover responsive style={{ marginBottom: 0 }}>
            <thead>
              <tr>
                <th style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>Event Name</th>
                <th style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>Status</th>
                <th style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>Progress</th>
                <th style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>Last Updated</th>
                <th style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentRequests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4">
                    No requests found
                  </td>
                </tr>
              ) : (
                recentRequests.map((request) => {
                  const progress = calculateProgress(request)
                  return (
                    <tr key={request.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/requests/${request.id}`)}>
                      <td style={{ color: 'var(--primary-navy)', fontWeight: 600 }}>
                        {request.title || request.eventName || 'Untitled Request'}
                      </td>
                      <td>{getStatusBadge(request.status)}</td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <ProgressBar 
                            now={(progress.current / progress.total) * 100} 
                            style={{ flex: 1, height: '8px' }}
                          />
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', minWidth: '35px' }}>
                            {progress.current}/{progress.total}
                          </span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {formatDate(request.updatedAt || request.createdAt)}
                      </td>
                      <td>
                        <a 
                          href={`/requests/${request.id}`} 
                          style={{ color: 'var(--primary-orange)', fontWeight: 600, textDecoration: 'none' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          View / Edit →
                        </a>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </Table>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
