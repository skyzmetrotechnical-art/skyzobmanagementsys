import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute, RoleRoute } from './components/ProtectedRoute'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import RequestsList from './pages/RequestsList'
import RequestFlow from './pages/RequestFlow'
import Profile from './pages/Profile'
import Admin from './pages/Admin'
import NewRequest from './pages/NewRequest'

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route element={<ProtectedRoute />}> 
          <Route
            path="/"
            element={
              <AppLayout>
                <Dashboard />
              </AppLayout>
            }
          />

          <Route
            path="/requests"
            element={
              <AppLayout>
                <RequestsList />
              </AppLayout>
            }
          />
          <Route
            path="/requests/:id"
            element={
              <AppLayout>
                <RequestFlow />
              </AppLayout>
            }
          />

          <Route element={<RoleRoute allow={['marketing']} />}> 
            <Route
              path="/requests/new"
              element={
                <AppLayout>
                  <NewRequest />
                </AppLayout>
              }
            />
          </Route>

          <Route
            path="/profile"
            element={
              <AppLayout>
                <Profile />
              </AppLayout>
            }
          />

          <Route element={<RoleRoute allow={['systemAdmin']} />}> 
            <Route
              path="/admin"
              element={
                <AppLayout>
                  <Admin />
                </AppLayout>
              }
            />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
