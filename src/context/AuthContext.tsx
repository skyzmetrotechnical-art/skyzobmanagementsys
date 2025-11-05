import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, type User } from 'firebase/auth'
import { auth, db } from '../firebase'
import { ref, get, set, serverTimestamp } from 'firebase/database'

export type Department = 'marketing' | 'programming' | 'technical' | 'admin' | 'finance' | 'systemAdmin'

export interface AppUserProfile {
  uid: string
  displayName?: string
  email: string
  department: Department
  role: 'user' | 'admin'
  signatureRef?: string
  digitalSignature?: {
    name: string
    uid: string
    email: string
    createdAt: string
    signatureId: string
    signwellId?: string
    signatureUrl?: string
    type: 'signwell' | 'local'
  }
  approvalPin?: string
  position?: string
}

interface AuthContextShape {
  fbUser: User | null
  profile: AppUserProfile | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, displayName: string, department: Department, role: 'user' | 'admin') => Promise<void>
  logout: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextShape | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [fbUser, setFbUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<AppUserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadUserProfile = async (u: User) => {
    const userRef = ref(db, `users/${u.uid}`)
    const snap = await get(userRef)
    if (snap.exists()) {
      const data = snap.val() as any
      setProfile({
        uid: u.uid,
        email: u.email || '',
        displayName: data.displayName,
        department: data.department,
        role: data.role || 'user',
        signatureRef: data.signatureRef,
        digitalSignature: data.digitalSignature,
        approvalPin: data.approvalPin,
        position: data.position,
      })
    } else {
      setProfile(null)
    }
  }

  const refreshProfile = async () => {
    if (fbUser) {
      await loadUserProfile(fbUser)
    }
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setFbUser(u)
      if (u) {
        await loadUserProfile(u)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signup = async (email: string, password: string, displayName: string, department: Department, role: 'user' | 'admin') => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    const uid = userCredential.user.uid
    const userRef = ref(db, `users/${uid}`)
    await set(userRef, {
      displayName,
      email,
      department,
      role,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
    })
  }

  const logout = async () => {
    await signOut(auth)
  }

  const value = useMemo(() => ({ fbUser, profile, loading, login, signup, logout, refreshProfile }), [fbUser, profile, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
