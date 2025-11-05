import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import bcrypt from 'bcryptjs';
import sendgrid from '@sendgrid/mail';
import axios from 'axios';
import PDFDocument from 'pdfkit';
admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();
// Config
const SIGNWELL_API_KEY = process.env.SIGNWELL_API_KEY || functions.params.defineSecret('SIGNWELL_API_KEY').value();
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || functions.params.defineSecret('SENDGRID_API_KEY').value();
const APP_BASE_URL = process.env.APP_BASE_URL || 'https://skyzobsystem.web.app';
sendgrid.setApiKey(SENDGRID_API_KEY);
const DEPT_FLOW = ['marketing', 'programming', 'technical', 'admin', 'finance', 'final'];
// Helpers
const nextDepartment = (current) => {
    const idx = DEPT_FLOW.indexOf(current);
    return idx >= 0 && idx < DEPT_FLOW.length - 1 ? DEPT_FLOW[idx + 1] : null;
};
export const setApprovalPin = functions.https.onCall(async (request) => {
    if (!request.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    const pin = request.data.pin;
    if (!/^\d{4,8}$/.test(pin))
        throw new functions.https.HttpsError('invalid-argument', 'PIN must be 4-8 digits');
    const hash = await bcrypt.hash(pin, 10);
    await db.collection('users').doc(request.auth.uid).set({ approvalPinHash: hash }, { merge: true });
    return { ok: true };
});
export const verifyPIN = functions.https.onCall(async (request) => {
    if (!request.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    const pin = request.data.pin;
    const user = await db.collection('users').doc(request.auth.uid).get();
    const hash = user.get('approvalPinHash');
    if (!hash)
        throw new functions.https.HttpsError('failed-precondition', 'PIN not set');
    const ok = await bcrypt.compare(pin, hash);
    if (!ok)
        throw new functions.https.HttpsError('permission-denied', 'Invalid PIN');
    return { ok: true };
});
export const listSignatures = functions.https.onCall(async (request) => {
    if (!request.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    // Placeholder: fetch from Signwell
    if (!SIGNWELL_API_KEY)
        return { signatures: [] };
    try {
        const resp = await axios.get('https://api.signwell.com/v1/templates', {
            headers: { Authorization: `Bearer ${SIGNWELL_API_KEY}` },
        });
        const signatures = (resp.data?.results || []).map((t) => ({ id: t.id, name: t.name }));
        return { signatures };
    }
    catch {
        return { signatures: [] };
    }
});
export const createSignature = functions.https.onCall(async (request) => {
    if (!request.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    if (!SIGNWELL_API_KEY)
        throw new functions.https.HttpsError('failed-precondition', 'Signwell not configured');
    const name = request.data.name || 'Signature';
    // This is a simplified placeholder call; real-world would create a reusable template or signature resource
    const resp = await axios.post('https://api.signwell.com/v1/templates', { name }, {
        headers: { Authorization: `Bearer ${SIGNWELL_API_KEY}` },
    });
    return { id: resp.data?.id };
});
export const approveRequest = functions.https.onCall(async (request) => {
    if (!request.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    const { requestId, signatureRef, pin } = request.data;
    if (!requestId || !signatureRef || !pin)
        throw new functions.https.HttpsError('invalid-argument', 'Missing parameters');
    // Verify PIN
    const authUid = request.auth.uid;
    const userDoc = await db.collection('users').doc(authUid).get();
    const hash = userDoc.get('approvalPinHash');
    if (!hash)
        throw new functions.https.HttpsError('failed-precondition', 'PIN not set');
    const ok = await bcrypt.compare(pin, hash);
    if (!ok)
        throw new functions.https.HttpsError('permission-denied', 'Invalid PIN');
    // Optional: verify signature via Signwell
    if (!SIGNWELL_API_KEY)
        functions.logger.warn('SIGNWELL_API_KEY not set; skipping signature verification');
    await db.runTransaction(async (tx) => {
        const ref = db.collection('requests').doc(requestId);
        const snap = await tx.get(ref);
        if (!snap.exists)
            throw new functions.https.HttpsError('not-found', 'Request not found');
        const data = snap.data();
        const userDept = (await db.collection('users').doc(authUid).get()).get('department');
        const currentStep = data.currentStep;
        if (userDept !== currentStep)
            throw new functions.https.HttpsError('permission-denied', 'Not your step');
        const next = nextDepartment(currentStep);
        const updates = {};
        updates[`steps.${currentStep}`] = { status: 'approved', signatureRef, timestamp: admin.firestore.FieldValue.serverTimestamp() };
        if (next) {
            updates.currentStep = next;
            updates.status = 'pending';
        }
        else {
            updates.status = 'approved';
        }
        const historyEntry = { eventType: 'approved', department: currentStep, timestamp: admin.firestore.FieldValue.serverTimestamp() };
        tx.update(ref, { ...updates, history: admin.firestore.FieldValue.arrayUnion(historyEntry) });
    });
    // Notify next department
    await sendNotificationFn(requestId, 'approved');
    // If final approval, generate PDF
    const req = await db.collection('requests').doc(requestId).get();
    if (req.get('status') === 'approved') {
        await generatePdfAndArchive(requestId);
    }
    return { ok: true };
});
export const rejectRequest = functions.https.onCall(async (request) => {
    if (!request.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
    const { requestId, reason } = request.data;
    if (!requestId || !reason)
        throw new functions.https.HttpsError('invalid-argument', 'Missing parameters');
    await db.runTransaction(async (tx) => {
        const ref = db.collection('requests').doc(requestId);
        const snap = await tx.get(ref);
        if (!snap.exists)
            throw new functions.https.HttpsError('not-found', 'Request not found');
        const data = snap.data();
        const currentStep = data.currentStep;
        // Reset previous approvals
        const steps = { ...data.steps };
        for (const k of Object.keys(steps)) {
            if (DEPT_FLOW.indexOf(k) >= DEPT_FLOW.indexOf(currentStep))
                break;
            steps[k] = { status: 'pending' };
        }
        tx.update(ref, {
            steps,
            status: 'rejected',
            history: admin.firestore.FieldValue.arrayUnion({ eventType: 'rejected', department: currentStep, reason, timestamp: admin.firestore.FieldValue.serverTimestamp() }),
        });
    });
    await sendNotificationFn(requestId, 'rejected', reason);
    return { ok: true };
});
async function sendNotificationFn(requestId, type, reason) {
    if (!SENDGRID_API_KEY) {
        functions.logger.warn('SENDGRID_API_KEY not set; skipping email notifications');
        return;
    }
    const reqSnap = await db.collection('requests').doc(requestId).get();
    const title = reqSnap.get('title');
    const link = `${APP_BASE_URL}/requests/${requestId}`;
    const subject = type === 'approved' ? `Request advanced: ${title}` : `Request rejected: ${title}`;
    const html = `<p>Request <b>${title}</b> (${requestId}) was ${type}. ${reason ? `Reason: ${reason}` : ''}</p><p><a href="${link}">Open in system</a></p>`;
    const msg = {
        to: 'notifications@example.com',
        from: 'noreply@skyzobsystem.firebaseapp.com',
        subject,
        html,
    };
    await sendgrid.send(msg);
}
async function generatePdfAndArchive(requestId) {
    const reqSnap = await db.collection('requests').doc(requestId).get();
    const data = reqSnap.data();
    const doc = new PDFDocument();
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
    doc.fontSize(18).text('OB Request Summary', { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Event: ${data.title}`);
    doc.text(`Location: ${data.location}`);
    doc.text(`Status: ${data.status}`);
    doc.moveDown();
    doc.text('Approvals:');
    for (const d of DEPT_FLOW) {
        const s = data.steps?.[d];
        doc.text(`- ${d}: ${s?.status || 'pending'} ${s?.timestamp ? '(' + s.timestamp.toDate?.() + ')' : ''}`);
    }
    doc.end();
    const buffer = await done;
    const file = storage.bucket().file(`requests/${requestId}/summary.pdf`);
    await file.save(buffer, { contentType: 'application/pdf' });
}
