import React, { useEffect, useMemo, useState } from 'react'
import { ref, get } from 'firebase/database'
import { db } from '../firebase'
import { Badge, Card, Form, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'

export interface RequestItem {
  id: string
  title: string
  location: string
  createdBy: string
  currentStep: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt?: any
}

const RequestsList: React.FC = () => {
  const [items, setItems] = useState<RequestItem[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [userNames, setUserNames] = useState<Record<string, string>>({})

  useEffect(() => {
    const load = async () => {
      // Load requests
      const requestsRef = ref(db, 'requests')
      const snap = await get(requestsRef)
      if (snap.exists()) {
        const requests = snap.val()
        const array = Object.entries(requests).map(([id, data]: [string, any]) => ({ id, ...data }))
        array.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        setItems(array)

        // Load user names
        const usersRef = ref(db, 'users')
        const usersSnap = await get(usersRef)
        if (usersSnap.exists()) {
          const users = usersSnap.val()
          const names: Record<string, string> = {}
          Object.entries(users).forEach(([uid, data]: [string, any]) => {
            names[uid] = data.displayName || data.email || 'Unknown'
          })
          setUserNames(names)
        }
      }
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    if (filter === 'all') return items
    return items.filter((i) => i.status === filter)
  }, [items, filter])

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">OB Requests</h1>
        <p className="page-subtitle">View and manage all outdoor broadcast requests</p>
      </div>

      <Card className="custom-card">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">All Requests</h5>
          <Form.Select style={{ width: 220 }} value={filter} onChange={(e) => setFilter(e.target.value as any)}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </Form.Select>
        </div>
        <Table hover responsive size="sm">
          <thead>
            <tr>
              <th>Event</th>
              <th>Location</th>
              <th>Created By</th>
              <th>Current Step</th>
              <th>Status</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => (
              <tr key={i.id}>
                <td>{i.title}</td>
                <td>{i.location}</td>
                <td>{userNames[i.createdBy] || i.createdBy}</td>
                <td className="text-capitalize">{i.currentStep}</td>
                <td>
                  <Badge bg={i.status === 'pending' ? 'warning' : i.status === 'approved' ? 'success' : 'danger'}>
                    {i.status}
                  </Badge>
                  {i.status === 'rejected' && i.rejectedBy && (
                    <div className="small text-danger fw-semibold mt-1">
                      By: {i.rejectedBy.charAt(0).toUpperCase() + i.rejectedBy.slice(1)}
                    </div>
                  )}
                </td>
                <td>
                  <Link to={`/requests/${i.id}`} className="btn btn-sm btn-outline-primary">View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        {filtered.length === 0 && (
          <div className="text-center py-5">
            <p className="text-muted mb-0">No requests found</p>
          </div>
        )}
      </Card.Body>
    </Card>
    </div>
  )
}

export default RequestsList
