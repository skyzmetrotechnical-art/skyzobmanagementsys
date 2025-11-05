import React, { useEffect, useState } from 'react'
import { ref, get } from 'firebase/database'
import { db } from '../firebase'
import { Col, Row } from 'react-bootstrap'
import { useAuth } from '../context/AuthContext'

const Dashboard: React.FC = () => {
  const [pending, setPending] = useState(0)
  const [approved, setApproved] = useState(0)
  const [rejected, setRejected] = useState(0)
  const [total, setTotal] = useState(0)
  const { profile } = useAuth()

  useEffect(() => {
    const load = async () => {
      const requestsRef = ref(db, 'requests')
      const snap = await get(requestsRef)
      if (snap.exists()) {
        const requests = snap.val()
        const values = Object.values(requests) as any[]
        setPending(values.filter((r) => r.status === 'pending').length)
        setApproved(values.filter((r) => r.status === 'approved').length)
        setRejected(values.filter((r) => r.status === 'rejected').length)
        setTotal(values.length)
      }
    }
    load()
  }, [])

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Dashboard Overview</h1>
        <p className="page-subtitle">
          Welcome back, {profile?.displayName || profile?.email}! Here's what's happening with your requests today.
        </p>
      </div>

      {/* Stats Cards */}
      <Row className="g-4 mb-4">
        <Col md={6} xl={3}>
          <div className="stats-card">
            <div className="stats-card-header">
              <div>
                <h6 className="stats-card-title">Total Requests</h6>
              </div>
              <div className="stats-card-icon primary">
                📋
              </div>
            </div>
            <div className="stats-card-value">{total}</div>
            <div className="stats-card-footer">
              <span className="stats-card-period">All time</span>
            </div>
          </div>
        </Col>

        <Col md={6} xl={3}>
          <div className="stats-card">
            <div className="stats-card-header">
              <div>
                <h6 className="stats-card-title">Pending Requests</h6>
              </div>
              <div className="stats-card-icon warning">
                ⏳
              </div>
            </div>
            <div className="stats-card-value">{pending}</div>
            <div className="stats-card-footer">
              <span className="stats-card-period">Awaiting approval</span>
            </div>
          </div>
        </Col>

        <Col md={6} xl={3}>
          <div className="stats-card">
            <div className="stats-card-header">
              <div>
                <h6 className="stats-card-title">Approved</h6>
              </div>
              <div className="stats-card-icon success">
                ✓
              </div>
            </div>
            <div className="stats-card-value">{approved}</div>
            <div className="stats-card-footer">
              <span className="stats-card-change positive">
                {total > 0 ? `${Math.round((approved / total) * 100)}%` : '0%'}
              </span>
              <span className="stats-card-period">success rate</span>
            </div>
          </div>
        </Col>

        <Col md={6} xl={3}>
          <div className="stats-card">
            <div className="stats-card-header">
              <div>
                <h6 className="stats-card-title">Rejected</h6>
              </div>
              <div className="stats-card-icon danger">
                ✗
              </div>
            </div>
            <div className="stats-card-value">{rejected}</div>
            <div className="stats-card-footer">
              <span className="stats-card-change negative">
                {total > 0 ? `${Math.round((rejected / total) * 100)}%` : '0%'}
              </span>
              <span className="stats-card-period">rejection rate</span>
            </div>
          </div>
        </Col>
      </Row>

      {/* Quick Actions */}
      <Row className="g-4">
        <Col lg={6}>
          <div className="custom-card">
            <div className="card-body">
              <h5 className="mb-3">Quick Actions</h5>
              <div className="d-flex flex-column gap-2">
                {profile?.department === 'marketing' && (
                  <a href="/requests/new" className="btn btn-primary">
                    ➕ Create New Request
                  </a>
                )}
                <a href="/requests" className="btn btn-outline-primary">
                  📋 View All Requests
                </a>
                <a href="/profile" className="btn btn-outline-secondary">
                  👤 Manage Profile
                </a>
              </div>
            </div>
          </div>
        </Col>

        <Col lg={6}>
          <div className="custom-card">
            <div className="card-body">
              <h5 className="mb-3">Your Department</h5>
              <div className="mb-3">
                <strong>Department:</strong> <span className="text-capitalize">{profile?.department}</span>
              </div>
              <div className="mb-3">
                <strong>Role:</strong> <span className="text-capitalize">{profile?.role}</span>
              </div>
              <p className="text-muted mb-0">
                {pending > 0 
                  ? `You have ${pending} pending request${pending !== 1 ? 's' : ''} awaiting review.`
                  : 'All requests are up to date!'}
              </p>
            </div>
          </div>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard
