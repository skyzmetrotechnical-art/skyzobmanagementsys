import React, { useState } from 'react'
import { ref, push, serverTimestamp, get } from 'firebase/database'
import { db } from '../firebase'
import { Button, Card, Col, Form, Row, Modal, Alert, Badge } from 'react-bootstrap'
import { useNavigate, Link } from 'react-router-dom'
import { ToastContainer, toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'

const stepsTemplate = {
  marketing: { status: 'pending', form: {} },
  programming: { status: 'pending', form: {} },
  technical: { status: 'pending', form: {} },
  admin: { status: 'pending', form: {} },
  finance: { status: 'pending', form: {} },
  final: { status: 'pending', form: {} },
}

const NewRequest: React.FC = () => {
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [client, setClient] = useState('')
  const [proposedSchedule, setProposedSchedule] = useState('')
  const [estimatedCost, setEstimatedCost] = useState('')
  const [crewRequired, setCrewRequired] = useState({
    Technical: false,
    SocialMedia: false,
    Marketing: false,
    Programming: false,
    Finance: false,
    other: false,
  })
  const [notes, setNotes] = useState('')
  const [showSignatureModal, setShowSignatureModal] = useState(false)
  const [pin, setPin] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const { profile } = useAuth()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !location || !proposedSchedule) {
      toast.error('Please fill in all required fields')
      return
    }
    setShowSignatureModal(true)
  }

  const confirmSubmit = async () => {
    if (!profile) return

    // Verify PIN
    if (!pin) {
      toast.error('Please enter your approval PIN')
      return
    }

    setSubmitting(true)

    try {
      const userRef = ref(db, `users/${profile.uid}`)
      const userSnap = await get(userRef)
      const userData = userSnap.val()
      
      if (!userData?.approvalPin) {
        toast.error('Please set your approval PIN in Profile first')
        setSubmitting(false)
        return
      }

      if (userData.approvalPin !== pin) {
        toast.error('Invalid PIN')
        setSubmitting(false)
        return
      }

      // Check if user has digital signature
      if (!userData?.digitalSignature) {
        toast.error('Please create your digital signature in Profile first')
        setSubmitting(false)
        return
      }

      const requestsRef = ref(db, 'requests')
      const newRef = await push(requestsRef, {
        title,
        location,
        client,
        proposedSchedule,
        estimatedCost: estimatedCost ? parseFloat(estimatedCost) : 0,
        crewRequired,
        marketingNotes: notes,
        createdBy: profile.uid,
        currentStep: 'programming',
        status: 'pending',
        steps: { 
          ...stepsTemplate, 
          marketing: { 
            status: 'approved',
            signedBy: profile.uid,
            digitalSignature: userData.digitalSignature,
            timestamp: serverTimestamp(),
            form: {
              title,
              location,
              client,
              proposedSchedule,
              estimatedCost: estimatedCost ? parseFloat(estimatedCost) : 0,
              crewRequired,
              notes,
            }
          } 
        },
        createdAt: serverTimestamp(),
        history: [
          { 
            eventType: 'created', 
            department: 'marketing', 
            by: profile.uid,
            timestamp: Date.now() 
          },
          { 
            eventType: 'approved', 
            department: 'marketing', 
            by: profile.uid,
            digitalSignature: userData.digitalSignature,
            timestamp: Date.now() 
          },
        ],
      })
      
      toast.success('Request created successfully!')
      setShowSignatureModal(false)
      navigate(`/requests/${newRef.key}`)
    } catch (e: any) {
      toast.error(e.message || 'Failed to create request')
      setSubmitting(false)
    }
  }

  return (
    <div>
      <ToastContainer />
      <div className="page-header">
        <h1 className="page-title">Create New Request</h1>
        <p className="page-subtitle">Submit a new outdoor broadcast request for approval</p>
      </div>

      <Card className="custom-card">
        <Card.Body>
          <h5 className="mb-3">Marketing Department - Request Details</h5>
          <p className="text-muted small mb-4">Initiates new OB requests, enters client/event details, proposed schedule, location, and estimated costs.</p>
        <Form onSubmit={handleSubmit}>
          <Row className="g-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label className="fw-semibold small">Client/Event Name <span className="text-danger">*</span></Form.Label>
                <Form.Control 
                  size="sm"
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  placeholder="e.g., Music Festival 2025"
                  required 
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label className="fw-semibold small">Location <span className="text-danger">*</span></Form.Label>
                <Form.Control 
                  size="sm"
                  value={location} 
                  onChange={(e) => setLocation(e.target.value)} 
                  placeholder="e.g., City Hall"
                  required 
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label className="fw-semibold small">Client</Form.Label>
                <Form.Control 
                  size="sm"
                  value={client} 
                  onChange={(e) => setClient(e.target.value)}
                  placeholder="Client name" 
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label className="fw-semibold small">Proposed Schedule <span className="text-danger">*</span></Form.Label>
                <Form.Control 
                  size="sm"
                  type="datetime-local"
                  value={proposedSchedule} 
                  onChange={(e) => setProposedSchedule(e.target.value)} 
                  required 
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label className="fw-semibold small">Estimated Cost ($)</Form.Label>
                <Form.Control 
                  size="sm"
                  type="number"
                  value={estimatedCost} 
                  onChange={(e) => setEstimatedCost(e.target.value)}
                  placeholder="e.g., 5000"
                  min="0"
                  step="0.01"
                />
              </Form.Group>
            </Col>
          </Row>

          <div className="mt-4">
            <Form.Label className="fw-semibold small mb-2">Crew Required</Form.Label>
            <div className="d-flex flex-column gap-1">
              <Form.Check
                type="checkbox"
                id="crew-technical"
                label="Technical"
                checked={crewRequired.Technical}
                onChange={(e) => setCrewRequired({ ...crewRequired, Technical: e.target.checked })}
                className="small"
              />
              <Form.Check
                type="checkbox"
                id="crew-social"
                label="Social Media"
                checked={crewRequired.SocialMedia}
                onChange={(e) => setCrewRequired({ ...crewRequired, SocialMedia: e.target.checked })}
                className="small"
              />
              <Form.Check
                type="checkbox"
                id="crew-Marketing"
                label="Marketing"
                checked={crewRequired.Marketing}
                onChange={(e) => setCrewRequired({ ...crewRequired, Marketing: e.target.checked })}
                className="small"
              />
              <Form.Check
                type="checkbox"
                id="crew-Programming"
                label="Programming"
                checked={crewRequired.Programming}
                onChange={(e) => setCrewRequired({ ...crewRequired, Programming: e.target.checked })}
                className="small"
              />
              <Form.Check
                type="checkbox"
                id="crew-Finance"
                label="Finance"
                checked={crewRequired.Finance}
                onChange={(e) => setCrewRequired({ ...crewRequired, Finance: e.target.checked })}
                className="small"
              />
              <Form.Check
                type="checkbox"
                id="crew-other"
                label="Other"
                checked={crewRequired.other}
                onChange={(e) => setCrewRequired({ ...crewRequired, other: e.target.checked })}
                className="small"
              />
            </div>
          </div>

          <div className="mt-4">
            <Form.Group>
              <Form.Label className="fw-semibold small">Notes</Form.Label>
              <Form.Control 
                size="sm"
                as="textarea" 
                rows={3} 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional notes or comments"
              />
            </Form.Group>
          </div>

          <div className="mt-4">
            <Button type="submit" variant="primary" size="sm">
              ➕ Create Request
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>

      {/* Digital Signature & PIN Confirmation Modal */}
      <Modal show={showSignatureModal} onHide={() => !submitting && setShowSignatureModal(false)} centered size="lg">
        <Modal.Header closeButton={!submitting}>
          <Modal.Title>✍️ Digital Signature & Confirmation</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info" className="small mb-3">
            <strong>Digital Signature Required</strong><br />
            This request will be digitally signed with your signature and requires your approval PIN for confirmation.
          </Alert>

          {/* Signature Display/Selection */}
          {profile?.digitalSignature ? (
            <div className="mb-4">
              <h6 className="small fw-bold mb-2">Your Digital Signature</h6>
              <div className="p-3 bg-light rounded border">
                <div className="d-flex align-items-center">
                  <div className="me-3" style={{ fontSize: '2rem' }}>✍️</div>
                  <div>
                    <div className="fw-semibold">{profile.digitalSignature.name}</div>
                    <div className="small text-muted">
                      ID: {profile.digitalSignature.signatureId}
                    </div>
                    {profile.digitalSignature.type === 'signwell' && (
                      <Badge bg="success" className="mt-1">Verified by Signwell</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <Alert variant="warning" className="mb-3">
              <h6 className="small mb-2"><strong>⚠️ No Digital Signature Found</strong></h6>
              <p className="small mb-2">You need to create a digital signature before you can submit requests.</p>
              <Button 
                size="sm" 
                variant="primary" 
                as={Link} 
                to="/profile"
                onClick={() => setShowSignatureModal(false)}
              >
                Go to Profile to Create Signature
              </Button>
            </Alert>
          )}

          {/* PIN Input */}
          {profile?.digitalSignature && (
            <Form.Group>
              <Form.Label className="small fw-bold">Approval PIN <span className="text-danger">*</span></Form.Label>
              <Form.Control 
                size="sm"
                type="password" 
                value={pin} 
                onChange={(e) => setPin(e.target.value)} 
                placeholder="Enter your PIN"
                disabled={submitting}
                autoFocus
              />
              <Form.Text className="text-muted">
                Enter the PIN you set in your profile to confirm and sign this request
              </Form.Text>
            </Form.Group>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button size="sm" variant="secondary" onClick={() => setShowSignatureModal(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button 
            size="sm" 
            variant="primary" 
            onClick={confirmSubmit} 
            disabled={!pin || submitting || !profile?.digitalSignature}
          >
            {submitting ? '⏳ Creating...' : '✓ Sign & Create Request'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export default NewRequest
