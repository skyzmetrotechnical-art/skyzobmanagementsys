import React, { useEffect, useState } from 'react'
import { Button, Card, Form, Row, Col, Table, Modal, Badge, Nav, Tab } from 'react-bootstrap'
import { ref, push, get, update, remove, set, serverTimestamp } from 'firebase/database'
import { db, auth } from '../firebase'
import { ToastContainer, toast } from 'react-toastify'
import type { Department } from '../context/AuthContext'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { useAuth } from '../context/AuthContext'

interface User {
  uid: string
  displayName: string
  email: string
  department: Department
  role: 'user' | 'admin'
  position?: string
  createdAt?: number
}

interface Equipment {
  id: string
  name: string
  department: string
  defaultQty: number
}

interface TeamMember {
  id: string
  name: string
  position: string
  department: Department
  email?: string
  phone?: string
}

const Admin: React.FC = () => {
  const { profile, fbUser } = useAuth()
  const [activeTab, setActiveTab] = useState('users')
  
  // Equipment state
  const [equipName, setEquipName] = useState('')
  const [equipDept, setEquipDept] = useState('technical')
  const [defaultQty, setDefaultQty] = useState(1)
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [showEquipModal, setShowEquipModal] = useState(false)
  const [editingEquip, setEditingEquip] = useState<Equipment | null>(null)

  // User management state
  const [users, setUsers] = useState<User[]>([])
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [userForm, setUserForm] = useState({
    displayName: '',
    email: '',
    password: '',
    department: 'marketing' as Department,
    role: 'user' as 'user' | 'admin',
    position: 'Manager' as string,
    customPosition: '',
  })
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [saving, setSaving] = useState(false)

  // Team members state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [editingTeam, setEditingTeam] = useState<TeamMember | null>(null)
  const [teamForm, setTeamForm] = useState({
    name: '',
    position: '',
    department: 'technical' as Department,
    email: '',
    phone: '',
  })

  const loadEquipment = async () => {
    const equipRef = ref(db, 'equipment')
    const snap = await get(equipRef)
    if (snap.exists()) {
      const equipment = snap.val()
      const array = Object.entries(equipment).map(([id, data]: [string, any]) => ({ id, ...data }))
      setEquipment(array)
    } else {
      setEquipment([])
    }
  }

  const loadUsers = async () => {
    const usersRef = ref(db, 'users')
    const snap = await get(usersRef)
    if (snap.exists()) {
      const usersData = snap.val()
      const array = Object.entries(usersData).map(([uid, data]: [string, any]) => ({
        uid,
        ...data,
      })) as User[]
      setUsers(array)
    } else {
      setUsers([])
    }
  }

  const loadTeamMembers = async () => {
    const teamRef = ref(db, 'teamMembers')
    const snap = await get(teamRef)
    if (snap.exists()) {
      const members = snap.val()
      const array = Object.entries(members).map(([id, data]: [string, any]) => ({ id, ...data }))
      setTeamMembers(array)
    } else {
      setTeamMembers([])
    }
  }

  useEffect(() => {
    loadEquipment()
    loadUsers()
    loadTeamMembers()
  }, [])

  const addEquipment = async () => {
    if (!equipName.trim()) {
      toast.error('Please enter equipment name')
      return
    }

    try {
      const equipRef = ref(db, 'equipment')
      await push(equipRef, {
        name: equipName,
        department: equipDept,
        defaultQty,
      })
      toast.success('Equipment added')
      setEquipName('')
      setDefaultQty(1)
      loadEquipment()
    } catch (e: any) {
      toast.error(e.message || 'Failed to add equipment')
    }
  }

  const handleOpenEquipModal = (equip?: Equipment) => {
    if (equip) {
      setEditingEquip(equip)
      setEquipName(equip.name)
      setEquipDept(equip.department)
      setDefaultQty(equip.defaultQty)
    } else {
      setEditingEquip(null)
      setEquipName('')
      setEquipDept('technical')
      setDefaultQty(1)
    }
    setShowEquipModal(true)
  }

  const handleCloseEquipModal = () => {
    setShowEquipModal(false)
    setEditingEquip(null)
    setEquipName('')
    setEquipDept('technical')
    setDefaultQty(1)
  }

  const handleSaveEquipment = async () => {
    if (!equipName.trim()) {
      toast.error('Please enter equipment name')
      return
    }

    try {
      if (editingEquip) {
        // Update existing equipment
        await update(ref(db, `equipment/${editingEquip.id}`), {
          name: equipName,
          department: equipDept,
          defaultQty,
        })
        toast.success('Equipment updated successfully')
      } else {
        // Add new equipment
        await push(ref(db, 'equipment'), {
          name: equipName,
          department: equipDept,
          defaultQty,
        })
        toast.success('Equipment added successfully')
      }
      handleCloseEquipModal()
      loadEquipment()
    } catch (e: any) {
      toast.error(e.message || 'Failed to save equipment')
    }
  }

  const handleDeleteEquipment = async (equip: Equipment) => {
    if (!window.confirm(`Are you sure you want to delete "${equip.name}"?`)) {
      return
    }

    try {
      await remove(ref(db, `equipment/${equip.id}`))
      toast.success('Equipment deleted successfully')
      loadEquipment()
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete equipment')
    }
  }

  // Team member management functions
  const handleOpenTeamModal = (member?: TeamMember) => {
    if (member) {
      setEditingTeam(member)
      setTeamForm({
        name: member.name,
        position: member.position,
        department: member.department,
        email: member.email || '',
        phone: member.phone || '',
      })
    } else {
      setEditingTeam(null)
      setTeamForm({
        name: '',
        position: '',
        department: 'technical',
        email: '',
        phone: '',
      })
    }
    setShowTeamModal(true)
  }

  const handleCloseTeamModal = () => {
    setShowTeamModal(false)
    setEditingTeam(null)
    setTeamForm({
      name: '',
      position: '',
      department: 'technical',
      email: '',
      phone: '',
    })
  }

  const handleSaveTeamMember = async () => {
    if (!teamForm.name.trim() || !teamForm.position.trim()) {
      toast.error('Please enter name and position')
      return
    }

    try {
      if (editingTeam) {
        // Update existing team member
        await update(ref(db, `teamMembers/${editingTeam.id}`), {
          name: teamForm.name.trim(),
          position: teamForm.position.trim(),
          department: teamForm.department,
          email: teamForm.email.trim() || null,
          phone: teamForm.phone.trim() || null,
        })
        toast.success('Team member updated successfully')
      } else {
        // Add new team member
        await push(ref(db, 'teamMembers'), {
          name: teamForm.name.trim(),
          position: teamForm.position.trim(),
          department: teamForm.department,
          email: teamForm.email.trim() || null,
          phone: teamForm.phone.trim() || null,
        })
        toast.success('Team member added successfully')
      }
      handleCloseTeamModal()
      loadTeamMembers()
    } catch (e: any) {
      toast.error(e.message || 'Failed to save team member')
    }
  }

  const handleDeleteTeamMember = async (member: TeamMember) => {
    if (!window.confirm(`Are you sure you want to delete "${member.name}"?`)) {
      return
    }

    try {
      await remove(ref(db, `teamMembers/${member.id}`))
      toast.success('Team member deleted successfully')
      loadTeamMembers()
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete team member')
    }
  }

  // Generate random password
  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }

  // User management functions
  const handleOpenUserModal = (user?: User) => {
    if (user) {
      setEditingUser(user)
      const isCustomPosition = user.position && !['Manager', 'Assistant', 'Engineer'].includes(user.position)
      setUserForm({
        displayName: user.displayName,
        email: user.email,
        password: '',
        department: user.department,
        role: user.role,
        position: isCustomPosition ? 'Custom' : (user.position || 'Manager'),
        customPosition: isCustomPosition ? user.position! : '',
      })
      setGeneratedPassword('')
    } else {
      const tempPassword = generatePassword()
      setEditingUser(null)
      setUserForm({
        displayName: '',
        email: '',
        password: tempPassword,
        department: 'marketing',
        role: 'user',
        position: 'Manager',
        customPosition: '',
      })
      setGeneratedPassword(tempPassword)
    }
    setShowUserModal(true)
  }

  const handleCloseUserModal = () => {
    setShowUserModal(false)
    setEditingUser(null)
    setUserForm({
      displayName: '',
      email: '',
      password: '',
      department: 'marketing',
      role: 'user',
      position: 'Manager',
      customPosition: '',
    })
    setGeneratedPassword('')
  }

  const handleSaveUser = async () => {
    if (!userForm.displayName || !userForm.email) {
      toast.error('Please fill in all required fields')
      return
    }

    if (userForm.position === 'Custom' && !userForm.customPosition.trim()) {
      toast.error('Please enter a custom position or select a predefined one')
      return
    }

    setSaving(true)

    try {
      if (editingUser) {
        // Update existing user
        const userRef = ref(db, `users/${editingUser.uid}`)
        const finalPosition = userForm.position === 'Custom' ? userForm.customPosition : userForm.position
        await update(userRef, {
          displayName: userForm.displayName,
          department: userForm.department,
          role: userForm.role,
          position: finalPosition,
        })
        toast.success('User updated successfully')
      } else {
        // Create new user
        if (!userForm.password) {
          toast.error('Password is required')
          setSaving(false)
          return
        }

        // Store current admin credentials
        const adminEmail = fbUser?.email
        const adminPassword = prompt('Please enter your admin password to continue:')
        
        if (!adminPassword) {
          toast.error('Admin password required to create users')
          setSaving(false)
          return
        }

        // Create new user account
        const userCredential = await createUserWithEmailAndPassword(auth, userForm.email, userForm.password)
        const newUserId = userCredential.user.uid

        // Create user profile in database
        const finalPosition = userForm.position === 'Custom' ? userForm.customPosition : userForm.position
        await set(ref(db, `users/${newUserId}`), {
          displayName: userForm.displayName,
          email: userForm.email,
          department: userForm.department,
          role: userForm.role,
          position: finalPosition,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
        })

        // Re-authenticate as admin
        if (adminEmail) {
          await signInWithEmailAndPassword(auth, adminEmail, adminPassword)
        }

        toast.success(`User created successfully! Temporary password: ${userForm.password}`)
      }

      handleCloseUserModal()
      loadUsers()
    } catch (e: any) {
      if (e.code === 'auth/email-already-in-use') {
        toast.error('This email is already in use')
      } else if (e.code === 'auth/weak-password') {
        toast.error('Password is too weak')
      } else if (e.code === 'auth/wrong-password') {
        toast.error('Incorrect admin password')
      } else {
        toast.error(e.message || 'Failed to save user')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteUser = async (user: User) => {
    if (!window.confirm(`Are you sure you want to delete user "${user.displayName || user.email}"?\n\nNote: This will only remove their profile data, not their authentication account.`)) {
      return
    }

    try {
      const userRef = ref(db, `users/${user.uid}`)
      await remove(userRef)
      toast.success('User deleted successfully')
      loadUsers()
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete user')
    }
  }

  return (
    <div>
      <ToastContainer />
      <div className="page-header">
        <h1 className="page-title">Admin Panel</h1>
        <p className="page-subtitle">Manage users, equipment, and system settings</p>
      </div>

      <Card className="custom-card">
        <Card.Body className="p-0">
          <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k || 'users')}>
            <Nav variant="tabs" className="px-3 pt-3">
              <Nav.Item>
                <Nav.Link eventKey="users">👥 User Management</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="equipment">🛠️ Equipment Management</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="team">👷 Team Members</Nav.Link>
              </Nav.Item>
            </Nav>

            <Tab.Content className="p-3">
              {/* User Management Tab */}
              <Tab.Pane eventKey="users">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="mb-0">Users</h5>
                  <Button variant="primary" size="sm" onClick={() => handleOpenUserModal()}>
                    ➕ Add New User
                  </Button>
                </div>
          
          <Table hover responsive>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Position</th>
                <th>Role</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.uid}>
                  <td>{user.displayName || '-'}</td>
                  <td>{user.email}</td>
                  <td className="text-capitalize">{user.department}</td>
                  <td>{user.position || '-'}</td>
                  <td>
                    <Badge bg={user.role === 'admin' ? 'danger' : 'secondary'}>
                      {user.role}
                    </Badge>
                  </td>
                  <td>
                    {user.createdAt 
                      ? new Date(user.createdAt).toLocaleDateString() 
                      : '-'}
                  </td>
                  <td>
                    <Button 
                      size="sm" 
                      variant="outline-primary" 
                      className="me-2"
                      onClick={() => handleOpenUserModal(user)}
                    >
                      ✏️ Edit
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline-danger"
                      onClick={() => handleDeleteUser(user)}
                    >
                      🗑️ Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          {users.length === 0 && (
            <div className="text-center py-4">
              <p className="text-muted mb-0">No users found</p>
            </div>
          )}
              </Tab.Pane>

              {/* Equipment Management Tab */}
              <Tab.Pane eventKey="equipment">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="mb-0">Equipment Management</h5>
                  <Button variant="primary" size="sm" onClick={() => handleOpenEquipModal()}>
                    ➕ Add Equipment
                  </Button>
                </div>
        <Table hover responsive size="sm">
          <thead>
            <tr>
              <th>Name</th>
              <th>Department</th>
              <th>Default Qty</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {equipment.map((e) => (
              <tr key={e.id}>
                <td>{e.name}</td>
                <td className="text-capitalize">{e.department}</td>
                <td>{e.defaultQty}</td>
                <td>
                  <Button 
                    size="sm" 
                    variant="outline-primary" 
                    className="me-2"
                    onClick={() => handleOpenEquipModal(e)}
                  >
                    ✏️ Edit
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline-danger"
                    onClick={() => handleDeleteEquipment(e)}
                  >
                    🗑️ Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        {equipment.length === 0 && (
          <div className="text-center py-4">
            <p className="text-muted mb-0">No equipment added yet</p>
          </div>
        )}
              </Tab.Pane>

              {/* Team Members Tab */}
              <Tab.Pane eventKey="team">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="mb-0">Team Members</h5>
                  <Button variant="primary" size="sm" onClick={() => handleOpenTeamModal()}>
                    ➕ Add Team Member
                  </Button>
                </div>

                <Table hover responsive size="sm">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Position</th>
                      <th>Department</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamMembers.map((member) => (
                      <tr key={member.id}>
                        <td>{member.name}</td>
                        <td>{member.position}</td>
                        <td className="text-capitalize">{member.department}</td>
                        <td>{member.email || '-'}</td>
                        <td>{member.phone || '-'}</td>
                        <td>
                          <Button 
                            size="sm" 
                            variant="outline-primary" 
                            className="me-2"
                            onClick={() => handleOpenTeamModal(member)}
                          >
                            ✏️ Edit
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline-danger"
                            onClick={() => handleDeleteTeamMember(member)}
                          >
                            🗑️ Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                {teamMembers.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-muted mb-0">No team members added yet</p>
                  </div>
                )}
              </Tab.Pane>
            </Tab.Content>
          </Tab.Container>
        </Card.Body>
      </Card>

      {/* User Edit Modal */}
      <Modal show={showUserModal} onHide={handleCloseUserModal} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {editingUser ? '✏️ Edit User' : '➕ Add New User'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {!editingUser && generatedPassword && (
            <div className="alert alert-warning mb-3">
              <strong>⚠️ Important:</strong> Save this temporary password and share it with the user securely.
              <div className="mt-2 p-2 bg-white border rounded">
                <code className="text-dark">{generatedPassword}</code>
                <Button 
                  size="sm" 
                  variant="link" 
                  className="ms-2"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedPassword)
                    toast.success('Password copied to clipboard!')
                  }}
                >
                  📋 Copy
                </Button>
              </div>
            </div>
          )}
          
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Display Name</Form.Label>
              <Form.Control
                type="text"
                value={userForm.displayName}
                onChange={(e) => setUserForm({ ...userForm, displayName: e.target.value })}
                placeholder="John Doe"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Email <span className="text-danger">*</span></Form.Label>
              <Form.Control
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                placeholder="user@radio.co"
                disabled={!!editingUser}
                readOnly={!!editingUser}
                required
              />
              {editingUser && (
                <Form.Text className="text-muted">
                  Email cannot be changed after account creation
                </Form.Text>
              )}
            </Form.Group>

            {!editingUser && (
              <Form.Group className="mb-3">
                <Form.Label>Temporary Password</Form.Label>
                <Form.Control
                  type="text"
                  value={userForm.password}
                  readOnly
                  className="bg-light"
                />
                <Form.Text className="text-muted">
                  This password was auto-generated. User should change it after first login.
                </Form.Text>
              </Form.Group>
            )}

            <Form.Group className="mb-3">
              <Form.Label>Department</Form.Label>
              <Form.Select
                value={userForm.department}
                onChange={(e) => setUserForm({ ...userForm, department: e.target.value as Department })}
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
              <Form.Label>Position</Form.Label>
              <Form.Select
                value={userForm.position}
                onChange={(e) => setUserForm({ ...userForm, position: e.target.value })}
              >
                <option value="Manager">Manager</option>
                <option value="Assistant">Assistant</option>
                <option value="Engineer">Engineer</option>
                <option value="Custom">Other (specify below)</option>
              </Form.Select>
            </Form.Group>

            {userForm.position === 'Custom' && (
              <Form.Group className="mb-3">
                <Form.Label>Custom Position</Form.Label>
                <Form.Control
                  type="text"
                  value={userForm.customPosition}
                  onChange={(e) => setUserForm({ ...userForm, customPosition: e.target.value })}
                  placeholder="Enter position title"
                />
              </Form.Group>
            )}

            <Form.Group className="mb-3">
              <Form.Label>Role</Form.Label>
              <Form.Select
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value as 'user' | 'admin' })}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </Form.Select>
              <Form.Text className="text-muted">
                Admins have full access to the admin panel
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseUserModal} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveUser} disabled={saving}>
            {saving ? (
              <>⏳ {editingUser ? 'Updating...' : 'Creating...'}</>
            ) : (
              <>💾 {editingUser ? 'Update User' : 'Create User'}</>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Equipment Edit Modal */}
      <Modal show={showEquipModal} onHide={handleCloseEquipModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {editingEquip ? '✏️ Edit Equipment' : '➕ Add Equipment'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Equipment Name <span className="text-danger">*</span></Form.Label>
              <Form.Control
                type="text"
                value={equipName}
                onChange={(e) => setEquipName(e.target.value)}
                placeholder="Enter equipment name"
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Department</Form.Label>
              <Form.Select
                value={equipDept}
                onChange={(e) => setEquipDept(e.target.value)}
              >
                <option value="technical">Technical</option>
                <option value="marketing">Marketing</option>
                <option value="programming">Programming</option>
                <option value="admin">Admin</option>
                <option value="finance">Finance</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Default Quantity</Form.Label>
              <Form.Control
                type="number"
                value={defaultQty}
                onChange={(e) => setDefaultQty(parseInt(e.target.value || '1', 10))}
                min="1"
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseEquipModal}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveEquipment}>
            💾 {editingEquip ? 'Update Equipment' : 'Add Equipment'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Team Member Modal */}
      <Modal show={showTeamModal} onHide={handleCloseTeamModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {editingTeam ? '✏️ Edit Team Member' : '➕ Add Team Member'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="small">Name <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    size="sm"
                    type="text"
                    value={teamForm.name}
                    onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                    placeholder="Full name"
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="small">Position <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    size="sm"
                    type="text"
                    value={teamForm.position}
                    onChange={(e) => setTeamForm({ ...teamForm, position: e.target.value })}
                    placeholder="e.g., Camera Operator"
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label className="small">Department</Form.Label>
              <Form.Select
                size="sm"
                value={teamForm.department}
                onChange={(e) => setTeamForm({ ...teamForm, department: e.target.value as Department })}
              >
                <option value="technical">Technical</option>
                <option value="marketing">Marketing</option>
                <option value="programming">Programming</option>
                <option value="admin">Admin</option>
                <option value="finance">Finance</option>
                <option value="systemAdmin">System Admin</option>
              </Form.Select>
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="small">Email</Form.Label>
                  <Form.Control
                    size="sm"
                    type="email"
                    value={teamForm.email}
                    onChange={(e) => setTeamForm({ ...teamForm, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="small">Phone</Form.Label>
                  <Form.Control
                    size="sm"
                    type="tel"
                    value={teamForm.phone}
                    onChange={(e) => setTeamForm({ ...teamForm, phone: e.target.value })}
                    placeholder="+1234567890"
                  />
                </Form.Group>
              </Col>
            </Row>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button size="sm" variant="secondary" onClick={handleCloseTeamModal}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" onClick={handleSaveTeamMember}>
            💾 {editingTeam ? 'Update' : 'Add'} Team Member
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

export default Admin
