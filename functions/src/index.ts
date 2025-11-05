import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'
import bcrypt from 'bcryptjs'
import sendgrid from '@sendgrid/mail'
import axios from 'axios'
import PDFDocument from 'pdfkit'

admin.initializeApp()
const db = admin.database()
const storage = admin.storage()

// Config
const SIGNWELL_API_KEY = process.env.SIGNWELL_API_KEY || functions.params.defineSecret('SIGNWELL_API_KEY').value()
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || functions.params.defineSecret('SENDGRID_API_KEY').value()
const APP_BASE_URL = process.env.APP_BASE_URL || 'https://skyzobsystem.web.app'

sendgrid.setApiKey(SENDGRID_API_KEY as string)

const DEPT_FLOW = ['marketing', 'programming', 'technical', 'admin', 'finance', 'final'] as const

// Helpers
const nextDepartment = (current: string) => {
  const idx = DEPT_FLOW.indexOf(current as any)
  return idx >= 0 && idx < DEPT_FLOW.length - 1 ? DEPT_FLOW[idx + 1] : null
}

export const setApprovalPin = functions.https.onCall(async (request) => {
  if (!request.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in required')
  const pin: string = (request.data as any).pin
  if (!/^\d{4,8}$/.test(pin)) throw new functions.https.HttpsError('invalid-argument', 'PIN must be 4-8 digits')
  const hash = await bcrypt.hash(pin, 10)
  await db.ref(`users/${request.auth.uid}`).update({ approvalPinHash: hash })
  return { ok: true }
})

export const verifyPIN = functions.https.onCall(async (request) => {
  if (!request.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in required')
  const pin: string = (request.data as any).pin
  const userSnap = await db.ref(`users/${request.auth.uid}`).get()
  const userData = userSnap.val()
  const hash = userData?.approvalPinHash
  if (!hash) throw new functions.https.HttpsError('failed-precondition', 'PIN not set')
  const ok = await bcrypt.compare(pin, hash)
  if (!ok) throw new functions.https.HttpsError('permission-denied', 'Invalid PIN')
  return { ok: true }
})

export const listSignatures = functions.https.onCall(async (request) => {
  if (!request.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in required')
  // Placeholder: fetch from Signwell
  if (!SIGNWELL_API_KEY) return { signatures: [] }
  try {
    const resp = await axios.get('https://api.signwell.com/v1/templates', {
      headers: { Authorization: `Bearer ${SIGNWELL_API_KEY}` },
    })
    const signatures = (resp.data?.results || []).map((t: any) => ({ id: t.id, name: t.name }))
    return { signatures }
  } catch {
    return { signatures: [] }
  }
})

export const createSignature = functions.https.onCall(async (request) => {
  if (!request.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in required')
  if (!SIGNWELL_API_KEY) throw new functions.https.HttpsError('failed-precondition', 'Signwell not configured')
  const name: string = (request.data as any).name || 'Signature'
  // This is a simplified placeholder call; real-world would create a reusable template or signature resource
  const resp = await axios.post('https://api.signwell.com/v1/templates', { name }, {
    headers: { Authorization: `Bearer ${SIGNWELL_API_KEY}` },
  })
  return { id: resp.data?.id }
})

export const approveRequest = functions.https.onCall(async (request) => {
  if (!request.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in required')
  const { requestId, signatureRef, pin } = (request.data as any) as { requestId: string; signatureRef: string; pin: string }
  if (!requestId || !signatureRef || !pin) throw new functions.https.HttpsError('invalid-argument', 'Missing parameters')

  // Verify PIN
  const authUid = request.auth!.uid as string
  const userSnap = await db.ref(`users/${authUid}`).get()
  const userData = userSnap.val()
  const hash = userData?.approvalPinHash
  if (!hash) throw new functions.https.HttpsError('failed-precondition', 'PIN not set')
  const ok = await bcrypt.compare(pin, hash)
  if (!ok) throw new functions.https.HttpsError('permission-denied', 'Invalid PIN')

  // Optional: verify signature via Signwell
  if (!SIGNWELL_API_KEY) functions.logger.warn('SIGNWELL_API_KEY not set; skipping signature verification')

  const requestRef = db.ref(`requests/${requestId}`)
  await requestRef.transaction((data) => {
    if (!data) throw new functions.https.HttpsError('not-found', 'Request not found')
    
    const userDept = userData.department
    const currentStep = data.currentStep
    if (userDept !== currentStep) throw new functions.https.HttpsError('permission-denied', 'Not your step')

    const next = nextDepartment(currentStep)
    data.steps[currentStep] = { status: 'approved', signatureRef, timestamp: admin.database.ServerValue.TIMESTAMP }
    
    if (next) {
      data.currentStep = next
      data.status = 'pending'
    } else {
      data.status = 'approved'
    }
    
    if (!data.history) data.history = []
    data.history.push({ eventType: 'approved', department: currentStep, timestamp: admin.database.ServerValue.TIMESTAMP })
    
    return data
  })

  // Notify next department
  await sendNotificationFn(requestId, 'approved')

  // If final approval, generate PDF
  const reqSnap = await db.ref(`requests/${requestId}`).get()
  const reqData = reqSnap.val()
  if (reqData?.status === 'approved') {
    await generatePdfAndArchive(requestId)
  }

  return { ok: true }
})

export const rejectRequest = functions.https.onCall(async (request) => {
  if (!request.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in required')
  const { requestId, reason } = (request.data as any) as { requestId: string; reason: string }
  if (!requestId || !reason) throw new functions.https.HttpsError('invalid-argument', 'Missing parameters')

  const requestRef = db.ref(`requests/${requestId}`)
  await requestRef.transaction((data) => {
    if (!data) throw new functions.https.HttpsError('not-found', 'Request not found')
    
    const currentStep = data.currentStep
    // Reset previous approvals
    const steps = { ...data.steps }
    for (const k of Object.keys(steps)) {
      if (DEPT_FLOW.indexOf(k as any) >= DEPT_FLOW.indexOf(currentStep as any)) break
      steps[k] = { status: 'pending' }
    }
    
    data.steps = steps
    data.status = 'rejected'
    
    if (!data.history) data.history = []
    data.history.push({ eventType: 'rejected', department: currentStep, reason, timestamp: admin.database.ServerValue.TIMESTAMP })
    
    return data
  })

  await sendNotificationFn(requestId, 'rejected', reason)
  return { ok: true }
})

async function sendNotificationFn(requestId: string, type: 'approved' | 'rejected', reason?: string) {
  if (!SENDGRID_API_KEY) {
    functions.logger.warn('SENDGRID_API_KEY not set; skipping email notifications')
    return
  }
  const reqSnap = await db.ref(`requests/${requestId}`).get()
  const reqData = reqSnap.val()
  const title = reqData?.title
  const link = `${APP_BASE_URL}/requests/${requestId}`
  const subject = type === 'approved' ? `Request advanced: ${title}` : `Request rejected: ${title}`
  const html = `<p>Request <b>${title}</b> (${requestId}) was ${type}. ${reason ? `Reason: ${reason}` : ''}</p><p><a href="${link}">Open in system</a></p>`
  const msg = {
    to: 'notifications@example.com',
    from: 'noreply@skyzobsystem.firebaseapp.com',
    subject,
    html,
  }
  await sendgrid.send(msg as any)
}

async function generatePdfAndArchive(requestId: string) {
  const reqSnap = await db.ref(`requests/${requestId}`).get()
  const data = reqSnap.val()
  const doc = new PDFDocument()
  const chunks: any[] = []
  doc.on('data', (c) => chunks.push(c))
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))))

  doc.fontSize(18).text('OB Request Summary', { underline: true })
  doc.moveDown()
  doc.fontSize(12).text(`Event: ${data.title}`)
  doc.text(`Location: ${data.location}`)
  doc.text(`Status: ${data.status}`)
  doc.moveDown()
  doc.text('Approvals:')
  for (const d of DEPT_FLOW) {
    const s = data.steps?.[d]
    doc.text(`- ${d}: ${s?.status || 'pending'} ${s?.timestamp ? '(' + new Date(s.timestamp).toISOString() + ')' : ''}`)
  }
  doc.end()
  const buffer = await done

  const file = storage.bucket().file(`requests/${requestId}/summary.pdf`)
  await file.save(buffer, { contentType: 'application/pdf' })
}
