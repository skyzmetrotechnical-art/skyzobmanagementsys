import React, { useState } from 'react'
import { Card, Button, Form, Alert, Row, Col, Badge } from 'react-bootstrap'
import { useAuth } from '../context/AuthContext'
import { ref, update } from 'firebase/database'
import { db, auth } from '../firebase'
import { ToastContainer, toast } from 'react-toastify'
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'

const Profile: React.FC = () => {
  const { profile, fbUser, refreshProfile } = useAuth()
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  // Digital signature state
  const [signatureName, setSignatureName] = useState('')
  const [creatingSignature, setCreatingSignature] = useState(false)

  const updatePin = async () => {
    if (!profile) return
    
    if (!/^\d{4,8}$/.test(pin)) {
      toast.error('PIN must be 4-8 digits')
      return
    }

    if (pin !== confirmPin) {
      toast.error('PINs do not match')
      return
    }

    try {
      await update(ref(db, `users/${profile.uid}`), {
        approvalPin: pin
      })
      
      // Refresh profile to update UI
      await refreshProfile()
      
      toast.success('PIN updated successfully')
      setPin('')
      setConfirmPin('')
    } catch (e: any) {
      toast.error(e.message || 'Failed to update PIN')
    }
  }

  const handleChangePassword = async () => {
    if (!fbUser || !fbUser.email) {
      toast.error('User not authenticated')
      return
    }

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields')
      return
    }

    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }

    if (currentPassword === newPassword) {
      toast.error('New password must be different from current password')
      return
    }

    setChangingPassword(true)

    try {
      // Re-authenticate user with current password
      const credential = EmailAuthProvider.credential(fbUser.email, currentPassword)
      await reauthenticateWithCredential(fbUser, credential)

      // Update password
      await updatePassword(fbUser, newPassword)

      toast.success('Password changed successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (e: any) {
      if (e.code === 'auth/wrong-password') {
        toast.error('Current password is incorrect')
      } else if (e.code === 'auth/weak-password') {
        toast.error('New password is too weak')
      } else if (e.code === 'auth/requires-recent-login') {
        toast.error('Please log out and log back in before changing your password')
      } else {
        toast.error(e.message || 'Failed to change password')
      }
    } finally {
      setChangingPassword(false)
    }
  }

  const createDigitalSignature = async () => {
    if (!profile) return

    if (!signatureName.trim()) {
      toast.error('Please enter your full name for the signature')
      return
    }

    setCreatingSignature(true)

    try {
      // Signwell API Integration
      const SIGNWELL_API_KEY = 'YWNjZXNzOmUwNTg2MGE5YzA3NTQ2ZTM1NWJlMTY1N2M1MGFmOTc4'
      const timestamp = new Date().toISOString()
      
      // Create signature with Signwell
      const signwellResponse = await fetch('https://www.signwell.com/api/v1/signatures/', {
        method: 'POST',
        headers: {
          'X-Api-Key': SIGNWELL_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: signatureName.trim(),
          email: profile.email,
          metadata: {
            userId: profile.uid,
            createdAt: timestamp,
          }
        })
      })

      if (!signwellResponse.ok) {
        // Fallback to local signature if Signwell fails
        console.warn('Signwell API failed, using local signature')
        const signature = {
          name: signatureName.trim(),
          uid: profile.uid,
          email: profile.email,
          createdAt: timestamp,
          signatureId: `SIG-${profile.uid}-${Date.now()}`,
          type: 'local',
        }

        await update(ref(db, `users/${profile.uid}`), {
          digitalSignature: signature
        })

        // Refresh profile to update UI
        await refreshProfile()

        toast.success('Digital signature created successfully!')
        setSignatureName('')
        setCreatingSignature(false)
        return
      }

      const signwellData = await signwellResponse.json()
      
      const signature = {
        name: signatureName.trim(),
        uid: profile.uid,
        email: profile.email,
        createdAt: timestamp,
        signatureId: signwellData.id || `SIG-${profile.uid}-${Date.now()}`,
        signwellId: signwellData.id,
        signatureUrl: signwellData.signature_url,
        type: 'signwell',
      }

      await update(ref(db, `users/${profile.uid}`), {
        digitalSignature: signature
      })

      // Refresh profile to update UI
      await refreshProfile()

      toast.success('Digital signature created successfully with Signwell!')
      setSignatureName('')
    } catch (e: any) {
      console.error('Signature creation error:', e)
      toast.error(e.message || 'Failed to create digital signature')
    } finally {
      setCreatingSignature(false)
    }
  }

  return (
    <div>
      <ToastContainer />
      <div className="page-header">
        <h1 className="page-title">Profile Settings</h1>
        <p className="page-subtitle">Manage your account information and approval PIN</p>
      </div>

      <Row className="g-4">
        <Col lg={4}>
          <Card className="custom-card h-100">
            <Card.Body>
              <h5 className="mb-3">Account Information</h5>
            
              <div className="mb-3">
                <div className="mb-2"><strong>Name:</strong> {profile?.displayName}</div>
                <div className="mb-2"><strong>Email:</strong> {profile?.email}</div>
                <div className="mb-2"><strong>Department:</strong> <span className="text-capitalize">{profile?.department}</span></div>
                <div className="mb-2"><strong>Role:</strong> <span className="text-capitalize">{profile?.role}</span></div>
              </div>

              <hr />

              <h6 className="mb-3">Approval PIN</h6>
              <Alert variant="info" className="small mb-3">
                Set a 4-8 digit PIN to approve or reject requests.
              </Alert>
              
              <Form.Group className="mb-3">
                <Form.Label className="small">New PIN (4-8 digits)</Form.Label>
                <Form.Control 
                  size="sm"
                  type="password" 
                  placeholder="Enter PIN" 
                  value={pin} 
                  onChange={(e) => setPin(e.target.value)}
                  maxLength={8}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label className="small">Confirm PIN</Form.Label>
                <Form.Control 
                  size="sm"
                  type="password" 
                  placeholder="Confirm PIN" 
                  value={confirmPin} 
                  onChange={(e) => setConfirmPin(e.target.value)}
                  maxLength={8}
                />
              </Form.Group>

              <Button size="sm" onClick={updatePin} disabled={!pin || !confirmPin} variant="primary">
                💾 Save PIN
              </Button>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={4}>
          <Card className="custom-card h-100">
            <Card.Body>
              <h5 className="mb-3">Change Password</h5>
              
              <Alert variant="warning" className="small mb-3">
                🔒 Enter your current password to change it.
              </Alert>

              <Form.Group className="mb-3">
                <Form.Label className="small">Current Password <span className="text-danger">*</span></Form.Label>
                <Form.Control 
                  size="sm"
                  type="password" 
                  placeholder="Enter current password" 
                  value={currentPassword} 
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={changingPassword}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label className="small">New Password <span className="text-danger">*</span></Form.Label>
                <Form.Control 
                  size="sm"
                  type="password" 
                  placeholder="Min 6 characters" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={changingPassword}
                  minLength={6}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label className="small">Confirm New Password <span className="text-danger">*</span></Form.Label>
                <Form.Control 
                  size="sm"
                  type="password" 
                  placeholder="Confirm new password" 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={changingPassword}
                />
              </Form.Group>

              <Button 
                size="sm"
                onClick={handleChangePassword} 
                disabled={!currentPassword || !newPassword || !confirmPassword || changingPassword} 
                variant="danger"
              >
                {changingPassword ? '⏳ Changing...' : '🔑 Change Password'}
              </Button>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={4}>
          <Card className="custom-card h-100">
            <Card.Body>
              <h5 className="mb-3">Digital Signature</h5>
              
              {profile?.digitalSignature ? (
                <>
                  <Alert variant="success" className="small mb-3">
                    ✓ Digital signature created
                  </Alert>
                  
                  <div className="mb-3 p-3 bg-light rounded border">
                    <div className="d-flex align-items-center mb-2">
                      <div className="me-2" style={{ fontSize: '1.5rem' }}>✍️</div>
                      <div className="flex-grow-1">
                        <div className="fw-semibold">{profile.digitalSignature.name}</div>
                        {profile.digitalSignature.type === 'signwell' && (
                          <Badge bg="success" className="mt-1">Verified by Signwell</Badge>
                        )}
                      </div>
                    </div>
                    <hr className="my-2" />
                    <div className="small mb-1"><strong>Signature ID:</strong> <code className="small">{profile.digitalSignature.signatureId}</code></div>
                    <div className="small"><strong>Created:</strong> {new Date(profile.digitalSignature.createdAt).toLocaleDateString()}</div>
                  </div>

                  <Alert variant="info" className="small">
                    Your digital signature is used to sign and approve requests.
                  </Alert>
                </>
              ) : (
                <>
                  <Alert variant="warning" className="small mb-3">
                    ⚠️ No digital signature created yet
                  </Alert>

                  <p className="small text-muted mb-3">
                    Create a digital signature to sign and approve OB requests. This signature will be linked to your account and used for authentication.
                  </p>

                  <Form.Group className="mb-3">
                    <Form.Label className="small">Full Name <span className="text-danger">*</span></Form.Label>
                    <Form.Control 
                      size="sm"
                      type="text" 
                      placeholder="Enter your full name" 
                      value={signatureName} 
                      onChange={(e) => setSignatureName(e.target.value)}
                      disabled={creatingSignature}
                    />
                    <Form.Text className="text-muted">
                      This name will appear on your digital signature
                    </Form.Text>
                  </Form.Group>

                  <Button 
                    size="sm"
                    onClick={createDigitalSignature} 
                    disabled={!signatureName.trim() || creatingSignature} 
                    variant="success"
                  >
                    {creatingSignature ? '⏳ Creating...' : '✍️ Create Signature'}
                  </Button>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Profile
