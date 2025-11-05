import React from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Dropdown } from 'react-bootstrap'
import logoImage from '../assets/logo.png'

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, logout } = useAuth()

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }
    return email ? email[0].toUpperCase() : 'U'
  }

  return (
    <div className="top-nav-layout">
      {/* Top Navigation Bar */}
      <nav className="top-navbar">
        <div className="top-navbar-container">
          <div className="top-navbar-brand">
            <NavLink to="/" className="brand-link">
              <img src={logoImage} style={{width: '80px'}}/>
              <span className="ml-3 font-semibold">OB System</span>
            </NavLink>
          </div>
          
          <div className="top-navbar-menu">
            <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
              📊 Dashboard
            </NavLink>
            
            <NavLink to="/requests" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              📋 Requests
            </NavLink>
            
            {profile?.department === 'marketing' && (
              <NavLink to="/requests/new" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                ➕ New Request
              </NavLink>
            )}
            
            <NavLink to="/profile" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              👤 Profile
            </NavLink>
            
            {(profile?.role === 'admin' || profile?.department === 'systemAdmin') && (
              <NavLink to="/admin" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                ⚙️ Admin
              </NavLink>
            )}
          </div>

          {profile && (
            <div className="top-navbar-user">
              <Dropdown align="end">
                <Dropdown.Toggle variant="link" className="user-dropdown-toggle" id="user-dropdown">
                  <div className="user-avatar">
                    {getInitials(profile.displayName, profile.email)}
                  </div>
                  <div className="user-info d-none d-lg-block">
                    <div className="user-name">{profile.displayName || profile.email}</div>
                    <div className="user-role">{profile.department}</div>
                  </div>
                </Dropdown.Toggle>

                <Dropdown.Menu>
                  <Dropdown.Item as={NavLink} to="/profile">
                    👤 Profile Settings
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item onClick={logout} className="text-danger">
                    🚪 Logout
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <div className="top-nav-content">
        {children}
      </div>
    </div>
  )
}

export default AppLayout
