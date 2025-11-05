import React, { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, Col, Form, ListGroup, Modal, Row, Alert } from 'react-bootstrap'
import { Link, useParams } from 'react-router-dom'
import { db } from '../firebase'
import { ref, get, update, serverTimestamp, push, set } from 'firebase/database'
import { useAuth } from '../context/AuthContext'
import { ToastContainer, toast } from 'react-toastify'
import Loading from '../components/Loading'
import Select from 'react-select'
import CreatableSelect from 'react-select/creatable'

const DEPT_ORDER = ['marketing', 'programming', 'technical', 'admin', 'finance', 'final'] as const

const nextDepartment = (current: string) => {
  const idx = DEPT_ORDER.indexOf(current as any)
  return idx >= 0 && idx < DEPT_ORDER.length - 1 ? DEPT_ORDER[idx + 1] : null
}

const RequestFlow: React.FC = () => {
  const { id } = useParams()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const { profile } = useAuth()
  const [showApprove, setShowApprove] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [pin, setPin] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [pendingFormData, setPendingFormData] = useState<any>(null)

  const canAct = useMemo(() => {
    if (!profile || !data) return false
    return data.currentStep === profile.department || (profile.role === 'admin' && data.status === 'pending')
  }, [profile, data])

  useEffect(() => {
    const load = async () => {
      if (!id) return
      const requestRef = ref(db, `requests/${id}`)
      const snap = await get(requestRef)
      if (snap.exists()) {
        setData({ id, ...snap.val() })
      }
      setLoading(false)
    }
    load()
  }, [id])

  const approve = async () => {
    if (!profile || !id) return

    // Save any pending form data first
    if (pendingFormData && Object.keys(pendingFormData).length > 0) {
      console.log('Auto-saving pending form data before approval:', pendingFormData)
      await saveDeptForm(pendingFormData)
      // Clear pending data after saving
      setPendingFormData(null)
    }

    // Verify PIN
    try {
      const userRef = ref(db, `users/${profile.uid}`)
      const userSnap = await get(userRef)
      const userData = userSnap.val()
      
      if (!userData?.approvalPin) {
        toast.error('Please set your approval PIN in Profile first')
        return
      }

      if (userData.approvalPin !== pin) {
        toast.error('Invalid PIN')
        return
      }

      // Check if user has digital signature
      if (!userData?.digitalSignature) {
        toast.error('Please create your digital signature in Profile first')
        return
      }

      // Check permission
      if (data.currentStep !== profile.department && profile.role !== 'admin') {
        toast.error('Not authorized to approve at this step')
        return
      }

      // Update request
      const requestRef = ref(db, `requests/${id}`)
      const currentStep = data.currentStep
      const next = nextDepartment(currentStep)

      const updates: any = {
        [`steps/${currentStep}/status`]: 'approved',
        [`steps/${currentStep}/signedBy`]: profile.uid,
        [`steps/${currentStep}/digitalSignature`]: userData.digitalSignature,
        [`steps/${currentStep}/timestamp`]: serverTimestamp(),
        [`steps/${currentStep}/approvedBy`]: profile.uid,
      }

      if (next) {
        updates.currentStep = next
        updates.status = 'pending'
        
        // Auto-approve Final step
        if (next === 'final') {
          updates[`steps/final/status`] = 'approved'
          updates[`steps/final/timestamp`] = serverTimestamp()
          updates[`steps/final/autoApproved`] = true
          updates.status = 'approved'
        }
      } else {
        updates.status = 'approved'
      }

      await update(requestRef, updates)

      // Add to history
      const historyRef = ref(db, `requests/${id}/history`)
      const historySnap = await get(historyRef)
      const history = historySnap.exists() ? historySnap.val() : []
      history.push({
        eventType: 'approved',
        department: currentStep,
        timestamp: Date.now(),
        by: profile.uid,
        digitalSignature: userData.digitalSignature,
      })
      
      // Add auto-approval history for Final step
      if (next === 'final') {
        history.push({
          eventType: 'approved',
          department: 'final',
          timestamp: Date.now(),
          autoApproved: true,
        })
      }
      
      await update(ref(db, `requests/${id}`), { history })

      toast.success('Request approved successfully')
      setShowApprove(false)
      setPin('')

      // Refresh data
      const snap = await get(requestRef)
      if (snap.exists()) {
        setData({ id, ...snap.val() })
      }
    } catch (e: any) {
      toast.error(e.message || 'Approval failed')
    }
  }

  const reject = async () => {
    if (!profile || !id) return

    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection')
      return
    }

    try {
      // Check permission
      if (data.currentStep !== profile.department && profile.role !== 'admin') {
        toast.error('Not authorized to reject at this step')
        return
      }

      // Update request
      const requestRef = ref(db, `requests/${id}`)
      const currentStep = data.currentStep

      // Reset previous approvals
      const steps = { ...data.steps }
      for (const k of Object.keys(steps)) {
        const kIdx = DEPT_ORDER.indexOf(k as any)
        const currentIdx = DEPT_ORDER.indexOf(currentStep as any)
        if (kIdx < currentIdx) {
          steps[k] = { status: 'pending' }
        }
      }

      await update(requestRef, {
        steps,
        status: 'rejected',
        rejectedBy: currentStep,
        rejectedReason: rejectReason,
        rejectedAt: serverTimestamp(),
        rejectedByUser: profile.uid,
      })

      // Add to history
      const historyRef = ref(db, `requests/${id}/history`)
      const historySnap = await get(historyRef)
      const history = historySnap.exists() ? historySnap.val() : []
      history.push({
        eventType: 'rejected',
        department: currentStep,
        reason: rejectReason,
        timestamp: Date.now(),
        by: profile.uid,
      })
      await update(ref(db, `requests/${id}`), { history })

      toast.success('Request rejected')
      setShowReject(false)
      setRejectReason('')

      // Refresh data
      const snap = await get(requestRef)
      if (snap.exists()) {
        setData({ id, ...snap.val() })
      }
    } catch (e: any) {
      toast.error(e.message || 'Rejection failed')
    }
  }

  const saveDeptForm = async (values: any) => {
    if (!id || !data) {
      toast.error('Missing request data')
      return
    }
    
    try {
      const currentStep = data.currentStep
      console.log('Saving form for step:', currentStep, 'with values:', values)
      
      const requestRef = ref(db, `requests/${id}`)
      await update(requestRef, {
        [`steps/${currentStep}/form`]: values,
      })
      
      console.log('Form saved successfully to database')
      toast.success(`${currentStep.charAt(0).toUpperCase() + currentStep.slice(1)} form saved successfully`)
      
      // Clear pending form data after successful save
      setPendingFormData(null)
      
      // Refresh data to show updated values
      const snap = await get(requestRef)
      if (snap.exists()) {
        setData({ id, ...snap.val() })
      }
    } catch (error: any) {
      console.error('Error saving form:', error)
      toast.error(`Failed to save form: ${error.message}`)
    }
  }

  if (loading) return <Loading fullScreen message="Loading request details..." />
  if (!data) return (
    <div className="text-center py-5">
      <h3 className="text-muted">Request Not Found</h3>
      <p className="text-secondary mb-4">The request you're looking for doesn't exist.</p>
      <Link to="/requests" className="btn btn-primary">Back to Requests</Link>
    </div>
  )

  const currentStepIndex = DEPT_ORDER.indexOf(data.currentStep as any)
  // Count approved steps + 1 for current active step
  const approvedSteps = DEPT_ORDER.filter(d => data.steps?.[d]?.status === 'approved').length
  const completedSteps = data.status === 'approved' ? DEPT_ORDER.length : approvedSteps + (currentStepIndex >= 0 ? 1 : 0)
  const progressPercent = (completedSteps / DEPT_ORDER.length) * 100

  return (
    <div className="workflow-container">
      <ToastContainer />
      <Row className="g-4">
        {/* Sidebar Steps */}
        <Col lg={3}>
          <Card className="workflow-sidebar">
            <Card.Body>
              <h6 className="mb-3 text-muted">WORKFLOW STEPS</h6>
              <div className="workflow-steps">
                {DEPT_ORDER.map((dept, index) => {
                  const stepStatus = data.steps?.[dept]?.status
                  const isActive = data.currentStep === dept
                  const isCompleted = stepStatus === 'approved'
                  const isRejected = stepStatus === 'rejected'

                  return (
                    <div key={dept} className={`workflow-step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isRejected ? 'rejected' : ''}`}>
                      <div className="workflow-step-marker">
                        {isCompleted ? '✓' : isRejected ? '✗' : index + 1}
                      </div>
                      <div className="workflow-step-content">
                        <div className="workflow-step-title text-capitalize">{dept}</div>
                        <div className="workflow-step-subtitle">
                          {isCompleted ? 'Completed' : isRejected ? 'Rejected' : isActive ? 'In Progress' : 'Pending'}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Main Content */}
        <Col lg={9}>
          <Card className="workflow-main-card">
            <Card.Body>
              {/* Progress Bar */}
              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="text-muted small">Progress</span>
                  <span className="fw-bold small">{completedSteps} of {DEPT_ORDER.length} steps</span>
                </div>
                <div className="progress" style={{ height: '8px' }}>
                  <div 
                    className="progress-bar bg-primary" 
                    role="progressbar" 
                    style={{ width: `${progressPercent}%` }}
                    aria-valuenow={progressPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
              </div>

              {/* Request Header */}
              <div className="mb-4">
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div>
                    <span className="badge bg-primary mb-2">
                      Step {currentStepIndex + 1}/{DEPT_ORDER.length}
                    </span>
                    <h4 className="mb-1">{data.title}</h4>
                    <p className="text-muted mb-0">
                      📍 {data.location} • Current: <span className="text-capitalize fw-bold">{data.currentStep}</span>
                    </p>
                  </div>
                  <Badge 
                    bg={data.status === 'pending' ? 'warning' : data.status === 'approved' ? 'success' : 'danger'} 
                    className="fs-6"
                  >
                    {data.status.toUpperCase()}
                  </Badge>
                </div>
              </div>

              {/* Rejection Alert */}
              {data.status === 'rejected' && data.rejectedBy && (
                <Alert variant="danger" className="mb-4">
                  <div className="d-flex align-items-start">
                    <div className="me-3" style={{ fontSize: '1.5rem' }}>❌</div>
                    <div className="flex-grow-1">
                      <h6 className="mb-2">
                        <strong>Request Rejected by {data.rejectedBy.charAt(0).toUpperCase() + data.rejectedBy.slice(1)} Department</strong>
                      </h6>
                      {data.rejectedReason && (
                        <div className="small mb-2">
                          <strong>Reason:</strong> {data.rejectedReason}
                        </div>
                      )}
                      {data.rejectedAt && (
                        <div className="small text-muted">
                          Rejected on: {new Date(data.rejectedAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                </Alert>
              )}

              {/* Action Buttons */}
              {canAct && (
                <div className="d-flex gap-2 mb-4">
                  <Button size="sm" variant="success" onClick={() => setShowApprove(true)}>
                    ✓ Approve
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setShowReject(true)}>
                    ✗ Reject
                  </Button>
                </div>
              )}

              {/* Department Form */}
              <DeptForm
                department={data.currentStep}
                values={data.steps?.[data.currentStep]?.form || {}}
                onSave={saveDeptForm}
                readOnly={!canAct}
                requestData={data}
                onChange={setPendingFormData}
              />

              {/* Back Link */}
              <div className="mt-4">
                <Link to="/requests" className="btn btn-sm btn-outline-secondary">
                  ← Back to Requests
                </Link>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Modal show={showApprove} onHide={() => setShowApprove(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>✍️ Digital Signature & Approval</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="success" className="small mb-3">
            <strong>Approval with Digital Signature</strong><br />
            By approving this request, you will digitally sign it with your signature. This action requires your approval PIN.
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
              <p className="small mb-2">You need to create a digital signature in your Profile before you can approve requests.</p>
              <Button 
                size="sm" 
                variant="primary" 
                as={Link} 
                to="/profile"
                onClick={() => setShowApprove(false)}
              >
                Go to Profile to Create Signature
              </Button>
            </Alert>
          )}

          {/* PIN Input */}
          {profile?.digitalSignature && (
            <Form>
              <Form.Group>
                <Form.Label className="small fw-bold">Approval PIN <span className="text-danger">*</span></Form.Label>
                <Form.Control 
                  size="sm"
                  type="password" 
                  value={pin} 
                  onChange={(e) => setPin(e.target.value)} 
                  placeholder="Enter your PIN"
                  required
                  autoFocus
                />
                <Form.Text className="text-muted">
                  Enter the PIN you set in your profile to confirm and sign this approval
                </Form.Text>
              </Form.Group>
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button size="sm" variant="secondary" onClick={() => setShowApprove(false)}>Cancel</Button>
          <Button 
            size="sm" 
            variant="success" 
            onClick={approve} 
            disabled={!pin || !profile?.digitalSignature}
          >
            ✓ Sign & Approve
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showReject} onHide={() => setShowReject(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Reject Request</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group>
              <Form.Label>Reason</Form.Label>
              <Form.Control size="sm" as="textarea" rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button size="sm" variant="secondary" onClick={() => setShowReject(false)}>Cancel</Button>
          <Button size="sm" variant="danger" onClick={reject}>Reject</Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

const DeptForm: React.FC<{ 
  department: string; 
  values: any; 
  onSave: (v: any) => void; 
  readOnly?: boolean;
  requestData?: any;
  onChange?: (v: any) => void;
}> = ({ department, values, onSave, readOnly, requestData, onChange }) => {
  const [formData, setFormData] = useState(values || {})
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [equipmentList, setEquipmentList] = useState<any[]>([])
  const [showDetailsModal, setShowDetailsModal] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      // Load team members
      const teamRef = ref(db, 'teamMembers')
      const teamSnap = await get(teamRef)
      if (teamSnap.exists()) {
        const members = teamSnap.val()
        const array = Object.entries(members).map(([id, data]: [string, any]) => ({ 
          value: id, 
          label: `${data.name} - ${data.position}`,
          ...data
        }))
        setTeamMembers(array)
      }

      // Load equipment
      const equipRef = ref(db, 'equipment')
      const equipSnap = await get(equipRef)
      if (equipSnap.exists()) {
        const equip = equipSnap.val()
        const array = Object.entries(equip).map(([id, data]: [string, any]) => ({ 
          value: id, 
          label: data.name,
          ...data
        }))
        setEquipmentList(array)
      }
    }
    loadData()
  }, [])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  const updateField = (field: string, value: any) => {
    const newData = { ...formData, [field]: value }
    setFormData(newData)
    // Notify parent of changes in real-time
    if (onChange) {
      onChange(newData)
    }
  }

  const printDetails = () => {
    window.print()
  }

  // Programming Department Form
  if (department === 'programming') {
    return (
      <Form onSubmit={submit}>
        <Row className="g-3">
          <Col md={6}>
            <Form.Group>
              <Form.Label className="fw-semibold small">Presenter/s</Form.Label>
              <Form.Control 
                size="sm"
                value={formData.presenters || ''} 
                onChange={(e) => updateField('presenters', e.target.value)} 
                disabled={readOnly}
                placeholder="e.g., John Doe, Jane Smith" 
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label className="fw-semibold small">Crossover Times</Form.Label>
              <CreatableSelect
                isMulti
                options={[
                  { value: '06:00-08:00', label: '06:00 - 08:00' },
                  { value: '08:00-10:00', label: '08:00 - 10:00' },
                  { value: '10:00-12:00', label: '10:00 - 12:00' },
                  { value: '12:00-14:00', label: '12:00 - 14:00' },
                  { value: '14:00-16:00', label: '14:00 - 16:00' },
                  { value: '16:00-18:00', label: '16:00 - 18:00' },
                  { value: '18:00-20:00', label: '18:00 - 20:00' },
                  { value: '20:00-22:00', label: '20:00 - 22:00' },
                ]}
                value={formData.crossoverTimes || []}
                onChange={(selected) => updateField('crossoverTimes', selected)}
                isDisabled={readOnly}
                placeholder="Select or type to add custom time slots"
                className="react-select-container"
                classNamePrefix="react-select"
              />
              <Form.Text className="text-muted small">
                Select from list or type custom time slot and press Enter
              </Form.Text>
            </Form.Group>
          </Col>
          <Col md={12}>
            <Form.Group>
              <Form.Label className="fw-semibold small">Content Alignment</Form.Label>
              <Form.Select
                size="sm"
                value={formData.contentAlignment || ''}
                onChange={(e) => updateField('contentAlignment', e.target.value)}
                disabled={readOnly}
              >
                <option value="">Select status...</option>
                <option value="approved">Approved</option>
                <option value="requires-adjustment">Requires Adjustment</option>
                <option value="rejected">Rejected</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={12}>
            <Form.Group>
              <Form.Label className="fw-semibold small">Notes</Form.Label>
              <Form.Control 
                size="sm"
                as="textarea" 
                rows={3} 
                value={formData.notes || ''} 
                onChange={(e) => updateField('notes', e.target.value)} 
                disabled={readOnly}
                placeholder="e.g., Conflicts with evening news broadcast"
              />
            </Form.Group>
          </Col>
        </Row>
        {!readOnly && (
          <div className="mt-3">
            <Button size="sm" type="submit">💾 Save Changes</Button>
          </div>
        )}
      </Form>
    )
  }

  // Technical Department Form
  if (department === 'technical') {
    const handleCrewCreate = async (inputValue: string) => {
      const newMember = {
        name: inputValue,
        position: 'Technical Staff',
        department: 'technical',
        email: '',
        phone: ''
      }
      const newRef = push(ref(db, 'teamMembers'))
      await set(newRef, newMember)
      const newOption = { value: newRef.key!, label: `${inputValue} - Technical Staff`, ...newMember }
      setTeamMembers([...teamMembers, newOption])
      const current = formData.crewMembers || []
      updateField('crewMembers', [...current, newOption])
    }

    const handleEquipmentCreate = async (inputValue: string) => {
      const newEquipment = {
        name: inputValue,
        type: 'Custom',
        status: 'available'
      }
      const newRef = push(ref(db, 'equipment'))
      await set(newRef, newEquipment)
      const newOption = { value: newRef.key!, label: inputValue, ...newEquipment }
      setEquipmentList([...equipmentList, newOption])
      const current = formData.equipment || []
      updateField('equipment', [...current, newOption])
    }

    return (
      <Form onSubmit={submit}>
        <Row className="g-3">
          <Col md={12}>
            <Form.Group>
              <Form.Label className="fw-semibold small">Crew Members Allocated</Form.Label>
              <CreatableSelect
                isMulti
                options={teamMembers.filter(m => m.department === 'technical')}
                value={formData.crewMembers || []}
                onChange={(selected) => updateField('crewMembers', selected)}
                onCreateOption={handleCrewCreate}
                isDisabled={readOnly}
                placeholder="Select crew members or type to add new..."
                className="react-select-container"
                classNamePrefix="react-select"
              />
              <Form.Text className="text-muted small">
                Select from existing crew or type name and press Enter to add new
              </Form.Text>
            </Form.Group>
          </Col>
          <Col md={12}>
            <Form.Group>
              <Form.Label className="fw-semibold small">Equipment Needed</Form.Label>
              <CreatableSelect
                isMulti
                options={equipmentList}
                value={formData.equipment || []}
                onChange={(selected) => updateField('equipment', selected)}
                onCreateOption={handleEquipmentCreate}
                isDisabled={readOnly}
                placeholder="Select equipment or type to add new..."
                className="react-select-container"
                classNamePrefix="react-select"
              />
              <Form.Text className="text-muted small">
                Select from existing equipment or type name and press Enter to add new
              </Form.Text>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label className="fw-semibold small">Feasibility Check</Form.Label>
              <Form.Select
                size="sm"
                value={formData.feasibility || ''}
                onChange={(e) => updateField('feasibility', e.target.value)}
                disabled={readOnly}
              >
                <option value="">Select...</option>
                <option value="feasible">Feasible</option>
                <option value="feasible-with-conditions">Feasible with conditions</option>
                <option value="not-feasible">Not Feasible</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={12}>
            <Form.Group>
              <Form.Label className="fw-semibold small">Technical Notes</Form.Label>
              <Form.Control 
                size="sm"
                as="textarea" 
                rows={3} 
                value={formData.notes || ''} 
                onChange={(e) => updateField('notes', e.target.value)} 
                disabled={readOnly}
                placeholder="e.g., Requires extra satellite truck. All crew available"
              />
            </Form.Group>
          </Col>
        </Row>
        {!readOnly && (
          <div className="mt-3">
            <Button size="sm" type="submit">💾 Save Changes</Button>
          </div>
        )}
      </Form>
    )
  }

  // Admin Department Form
  if (department === 'admin') {
    return (
      <Form onSubmit={submit}>
        <Row className="g-3">
          <Col md={12}>
            <Form.Group>
              <Form.Label className="fw-semibold small">Administrative Notes</Form.Label>
              <Form.Control 
                size="sm"
                as="textarea" 
                rows={4} 
                value={formData.notes || ''} 
                onChange={(e) => updateField('notes', e.target.value)} 
                disabled={readOnly}
                placeholder="Add any administrative notes, resource confirmations, or comments"
              />
            </Form.Group>
          </Col>
        </Row>
        {!readOnly && (
          <div className="mt-3">
            <Button size="sm" type="submit">💾 Save Changes</Button>
          </div>
        )}
      </Form>
    )
  }

  // Finance Department Form
  if (department === 'finance') {
    const marketingBudget = requestData?.estimatedCost || 'N/A'
    
    return (
      <Form onSubmit={submit}>
        <Row className="g-3">
          <Col md={12}>
            <Alert variant="info" className="small">
              <strong>Budget Requested by Marketing:</strong> ${marketingBudget}
            </Alert>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label className="fw-semibold small">Amount Allocated ($)</Form.Label>
              <Form.Control 
                size="sm"
                type="number"
                value={formData.amountAllocated || ''} 
                onChange={(e) => updateField('amountAllocated', e.target.value)} 
                disabled={readOnly}
                placeholder="e.g., 5000"
                step="0.01"
                min="0"
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label className="fw-semibold small">Budget Status</Form.Label>
              <Form.Select
                size="sm"
                value={formData.budgetStatus || ''}
                onChange={(e) => updateField('budgetStatus', e.target.value)}
                disabled={readOnly}
              >
                <option value="">Select status...</option>
                <option value="approved">Approved</option>
                <option value="pending-review">Pending Review</option>
                <option value="rejected">Rejected</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={12}>
            <Form.Group>
              <Form.Label className="fw-semibold small">Financial Notes</Form.Label>
              <Form.Control 
                size="sm"
                as="textarea" 
                rows={3} 
                value={formData.notes || ''} 
                onChange={(e) => updateField('notes', e.target.value)} 
                disabled={readOnly}
                placeholder="e.g., Budget approved. Funds will be released 48 hours before event"
              />
            </Form.Group>
          </Col>
        </Row>
        {!readOnly && (
          <div className="mt-3">
            <Button size="sm" type="submit">💾 Save Changes</Button>
          </div>
        )}
      </Form>
    )
  }

  // Final Review
  if (department === 'final') {
    return (
      <div>
        <Alert variant="success" className="mb-3">
          <h6 className="mb-2"><strong>✓ Request Approved by All Departments</strong></h6>
          <p className="small mb-0">This request has been reviewed and approved by all required departments and is ready for final archiving.</p>
        </Alert>

        <div className="p-3 bg-light rounded mb-3">
          <h6 className="small fw-bold mb-3">Request Summary</h6>
          <Row className="g-2 small">
            <Col md={6}>
              <div><strong>Event:</strong> {requestData?.title}</div>
              <div><strong>Location:</strong> {requestData?.location}</div>
              <div><strong>Client:</strong> {requestData?.client || 'N/A'}</div>
            </Col>
            <Col md={6}>
              <div><strong>Schedule:</strong> {requestData?.proposedSchedule ? new Date(requestData.proposedSchedule).toLocaleString() : 'N/A'}</div>
              <div><strong>Estimated Cost:</strong> ${requestData?.estimatedCost || 0}</div>
              <div><strong>Status:</strong> <Badge bg="success">Approved</Badge></div>
            </Col>
          </Row>
        </div>

        <div className="mb-3">
          <Button size="sm" variant="primary" onClick={() => setShowDetailsModal(true)}>
            📄 View Full Details
          </Button>
        </div>

        {!readOnly && (
          <Form onSubmit={submit} className="mt-3">
            <Form.Group>
              <Form.Label className="fw-semibold small">Final Notes</Form.Label>
              <Form.Control 
                size="sm"
                as="textarea" 
                rows={2} 
                value={formData.notes || ''} 
                onChange={(e) => updateField('notes', e.target.value)} 
                placeholder="Add any final notes for archiving"
              />
            </Form.Group>
            <div className="mt-2">
              <Button size="sm" type="submit">💾 Save Final Notes</Button>
            </div>
          </Form>
        )}

        {/* Full Details Modal */}
        <Modal show={showDetailsModal} onHide={() => setShowDetailsModal(false)} size="xl">
          <Modal.Header closeButton>
            <Modal.Title>Complete Request Details</Modal.Title>
          </Modal.Header>
          <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <div className="print-content">
              <h5 className="mb-3">OB Request Details - {requestData?.title}</h5>
              
              {/* Marketing */}
              <Card className="mb-3">
                <Card.Header className="bg-primary text-white">
                  <strong>Marketing Department</strong>
                  {requestData?.steps?.marketing?.timestamp && (
                    <span className="float-end small">
                      Approved: {new Date(requestData.steps.marketing.timestamp).toLocaleString()}
                    </span>
                  )}
                </Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={6}>
                      <p><strong>Event:</strong> {requestData?.title}</p>
                      <p><strong>Location:</strong> {requestData?.location}</p>
                      <p><strong>Client:</strong> {requestData?.client || 'N/A'}</p>
                    </Col>
                    <Col md={6}>
                      <p><strong>Schedule:</strong> {requestData?.proposedSchedule ? new Date(requestData.proposedSchedule).toLocaleString() : 'N/A'}</p>
                      <p><strong>Estimated Cost:</strong> ${requestData?.estimatedCost || 0}</p>
                      <p><strong>Crew Required:</strong> {Object.entries(requestData?.crewRequired || {})
                        .filter(([, v]) => v)
                        .map(([k]) => k)
                        .join(', ') || 'None'}</p>
                    </Col>
                  </Row>
                  {requestData?.marketingNotes && <p><strong>Notes:</strong> {requestData.marketingNotes}</p>}
                </Card.Body>
              </Card>

              {/* Programming */}
              {requestData?.steps?.programming && (
                <Card className="mb-3">
                  <Card.Header className="bg-info text-white">
                    <strong>Programming Department</strong>
                    {requestData?.steps?.programming?.timestamp && (
                      <span className="float-end small">
                        Approved: {new Date(requestData.steps.programming.timestamp).toLocaleString()}
                      </span>
                    )}
                  </Card.Header>
                  <Card.Body>
                    <p><strong>Presenters:</strong> {requestData.steps.programming.form?.presenters || 'N/A'}</p>
                    <p><strong>Crossover Times:</strong> {requestData.steps.programming.form?.crossoverTimes?.map((t: any) => t.label).join(', ') || 'N/A'}</p>
                    <p><strong>Content Alignment:</strong> {requestData.steps.programming.form?.contentAlignment || 'N/A'}</p>
                    {requestData.steps.programming.form?.notes && <p><strong>Notes:</strong> {requestData.steps.programming.form.notes}</p>}
                  </Card.Body>
                </Card>
              )}

              {/* Technical */}
              {requestData?.steps?.technical && (
                <Card className="mb-3">
                  <Card.Header className="bg-warning text-dark">
                    <strong>Technical Department</strong>
                    {requestData?.steps?.technical?.timestamp && (
                      <span className="float-end small">
                        Approved: {new Date(requestData.steps.technical.timestamp).toLocaleString()}
                      </span>
                    )}
                  </Card.Header>
                  <Card.Body>
                    <p><strong>Crew Members:</strong> {requestData.steps.technical.form?.crewMembers?.map((m: any) => m.label).join(', ') || 'N/A'}</p>
                    <p><strong>Equipment:</strong> {requestData.steps.technical.form?.equipment?.map((e: any) => e.label).join(', ') || 'N/A'}</p>
                    <p><strong>Feasibility:</strong> {requestData.steps.technical.form?.feasibility || 'N/A'}</p>
                    {requestData.steps.technical.form?.notes && <p><strong>Notes:</strong> {requestData.steps.technical.form.notes}</p>}
                  </Card.Body>
                </Card>
              )}

              {/* Admin */}
              {requestData?.steps?.admin && (
                <Card className="mb-3">
                  <Card.Header className="bg-secondary text-white">
                    <strong>Admin Department</strong>
                    {requestData?.steps?.admin?.timestamp && (
                      <span className="float-end small">
                        Approved: {new Date(requestData.steps.admin.timestamp).toLocaleString()}
                      </span>
                    )}
                  </Card.Header>
                  <Card.Body>
                    {requestData.steps.admin.form?.notes && <p><strong>Notes:</strong> {requestData.steps.admin.form.notes}</p>}
                  </Card.Body>
                </Card>
              )}

              {/* Finance */}
              {requestData?.steps?.finance && (
                <Card className="mb-3">
                  <Card.Header className="bg-success text-white">
                    <strong>Finance Department</strong>
                    {requestData?.steps?.finance?.timestamp && (
                      <span className="float-end small">
                        Approved: {new Date(requestData.steps.finance.timestamp).toLocaleString()}
                      </span>
                    )}
                  </Card.Header>
                  <Card.Body>
                    <p><strong>Amount Allocated:</strong> ${requestData.steps.finance.form?.amountAllocated || 0}</p>
                    <p><strong>Budget Status:</strong> {requestData.steps.finance.form?.budgetStatus || 'N/A'}</p>
                    {requestData.steps.finance.form?.notes && <p><strong>Notes:</strong> {requestData.steps.finance.form.notes}</p>}
                  </Card.Body>
                </Card>
              )}

              {/* Final */}
              {requestData?.steps?.final && requestData.steps.final.form?.notes && (
                <Card className="mb-3">
                  <Card.Header className="bg-dark text-white">
                    <strong>Final Notes</strong>
                  </Card.Header>
                  <Card.Body>
                    <p>{requestData.steps.final.form.notes}</p>
                  </Card.Body>
                </Card>
              )}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" size="sm" onClick={() => setShowDetailsModal(false)}>
              Close
            </Button>
            <Button variant="primary" size="sm" onClick={printDetails}>
              🖨️ Print
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    )
  }

  // Marketing (view only, already submitted)
  if (department === 'marketing') {
    return (
      <div className="p-3 bg-light rounded">
        <h6 className="small fw-bold mb-3">Marketing Department Details</h6>
        <Row className="g-2 small">
          <Col md={6}>
            <div><strong>Event:</strong> {requestData?.title}</div>
            <div><strong>Location:</strong> {requestData?.location}</div>
            <div><strong>Client:</strong> {requestData?.client || 'N/A'}</div>
          </Col>
          <Col md={6}>
            <div><strong>Schedule:</strong> {requestData?.proposedSchedule ? new Date(requestData.proposedSchedule).toLocaleString() : 'N/A'}</div>
            <div><strong>Estimated Cost:</strong> ${requestData?.estimatedCost || 0}</div>
          </Col>
        </Row>
        {requestData?.steps?.marketing?.notes && (
          <div className="mt-2">
            <strong>Notes:</strong> {requestData.steps.marketing.notes}
          </div>
        )}
      </div>
    )
  }

  return null
}

export default RequestFlow
