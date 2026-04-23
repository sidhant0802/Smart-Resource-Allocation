const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

// ═══════════════════════════════════════════════════════════
// Send Worker Assignment Email (with approve/reject links)
// ═══════════════════════════════════════════════════════════
exports.sendWorkerAssignmentEmail = async ({
  volunteerId,
  volunteerEmail,
  volunteerName,
  taskTitle,
  taskDescription,
  durationDays,
  slotNumber,
  totalSlots,
  assignmentToken,
  tokenExpiry,
  ngoName,
  startDate,
}) => {
  try {
    const progress = `${slotNumber}/${totalSlots}`
    const approveLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/approve-assignment/${assignmentToken}`
    const rejectLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reject-assignment/${assignmentToken}`
    const expiryTime = tokenExpiry
      ? new Date(tokenExpiry).toLocaleString('en-IN')
      : '24 hours from now'
    const startDateStr = startDate
      ? new Date(startDate).toLocaleDateString('en-IN', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'To be confirmed'

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#f3f4f6; color:#1f2937; line-height:1.6; }
          .container { max-width:600px; margin:0 auto; padding:20px; }
          .card { background:white; border-radius:16px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.1); }
          .header { background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%); padding:40px 32px; text-align:center; color:white; }
          .body { padding:32px; }
          .task-box { background:#f9fafb; border-left:4px solid #7c3aed; padding:20px; border-radius:8px; margin:24px 0; }
          .task-title { font-size:20px; font-weight:700; color:#111827; margin-bottom:8px; }
          .slot-badge { display:inline-block; background:#ede9fe; color:#7c3aed; padding:8px 16px; border-radius:20px; font-size:14px; font-weight:700; margin-top:12px; }
          .details-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:20px 0; }
          .detail-box { background:#f3f4f6; padding:14px; border-radius:10px; }
          .detail-label { font-size:11px; text-transform:uppercase; color:#9ca3af; margin-bottom:6px; letter-spacing:0.5px; }
          .detail-value { font-size:16px; font-weight:700; color:#111827; }
          .ngo-info { background:#eff6ff; border-left:4px solid #3b82f6; padding:12px 16px; border-radius:4px; margin:16px 0; font-size:13px; color:#1e40af; }
          .btn-group { display:flex; gap:12px; justify-content:center; margin:24px 0; }
          .btn { display:inline-block; padding:14px 32px; border-radius:10px; text-decoration:none; font-weight:700; font-size:15px; }
          .btn-yes { background:#10b981; color:white; }
          .btn-no { background:#ef4444; color:white; }
          .expiry-box { background:#fef3c7; border:1px solid #fcd34d; border-radius:10px; padding:14px 18px; font-size:13px; color:#92400e; margin:16px 0; }
          .steps { background:#f0fdf4; border-radius:10px; padding:16px; margin:16px 0; }
          .footer { text-align:center; padding:24px; border-top:1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">

            <div class="header">
              <div style="font-size:48px;margin-bottom:16px;">🎯</div>
              <h1 style="font-size:26px;font-weight:700;margin-bottom:8px;">You've Been Selected!</h1>
              <p style="opacity:0.9;font-size:15px;">${ngoName} needs your help</p>
            </div>

            <div class="body">
              <p style="font-size:16px;margin-bottom:16px;">
                Hi <strong>${volunteerName}</strong>,
              </p>
              <p style="font-size:14px;color:#6b7280;margin-bottom:8px;">
                <strong>${ngoName}</strong> has selected you for a volunteer assignment:
              </p>

              <div class="task-box">
                <div class="task-title">📋 ${taskTitle}</div>
                ${taskDescription ? `<p style="font-size:14px;color:#6b7280;line-height:1.6;margin-top:8px;">${taskDescription}</p>` : ''}
                <div class="slot-badge">👤 Slot ${progress}</div>
              </div>

              <div class="ngo-info">
                🏢 Organized by <strong>${ngoName}</strong>
              </div>

              <div class="details-grid">
                <div class="detail-box">
                  <div class="detail-label">⏱️ Duration</div>
                  <div class="detail-value">${durationDays} days</div>
                </div>
                <div class="detail-box">
                  <div class="detail-label">📅 Start Date</div>
                  <div class="detail-value" style="font-size:13px;">${startDateStr}</div>
                </div>
                <div class="detail-box">
                  <div class="detail-label">👥 Total Volunteers</div>
                  <div class="detail-value">${totalSlots} needed</div>
                </div>
                <div class="detail-box">
                  <div class="detail-label">📍 Your Slot</div>
                  <div class="detail-value">${progress}</div>
                </div>
              </div>

              <p style="font-size:15px;font-weight:600;text-align:center;margin:20px 0;color:#374151;">
                Will you accept this assignment?
              </p>

              <div class="btn-group">
                <a href="${approveLink}" class="btn btn-yes">✅ Yes, I'll Help!</a>
                <a href="${rejectLink}" class="btn btn-no">❌ Can't Do It</a>
              </div>

              <div class="expiry-box">
                ⏰ <strong>Respond by:</strong> ${expiryTime}
                <br>After this time, we'll select another volunteer.
              </div>

              <div class="steps">
                <div style="font-size:13px;font-weight:700;color:#166534;margin-bottom:10px;">
                  ✅ What happens when you accept?
                </div>
                <div style="font-size:12px;color:#15803d;margin:6px 0;">1️⃣ You'll receive a confirmation email</div>
                <div style="font-size:12px;color:#15803d;margin:6px 0;">2️⃣ Task becomes active when all ${totalSlots} slots fill (currently ${progress})</div>
                <div style="font-size:12px;color:#15803d;margin:6px 0;">3️⃣ You'll work for ${durationDays} days helping the community</div>
                <div style="font-size:12px;color:#15803d;margin:6px 0;">4️⃣ Get recognized for your contribution!</div>
              </div>

              <p style="font-size:13px;color:#9ca3af;text-align:center;margin-top:16px;">
                Questions? Reply to this email or contact ${ngoName} directly.
              </p>
            </div>

            <div class="footer">
              <p style="font-size:12px;color:#9ca3af;">© ${new Date().getFullYear()} NGO Volunteer Platform</p>
              <p style="font-size:11px;color:#d1d5db;margin-top:6px;">
                You received this because you are an approved volunteer.
              </p>
            </div>

          </div>
        </div>
      </body>
      </html>
    `

    const mailOptions = {
      from: `"NGO Platform" <${process.env.EMAIL_USER}>`,
      to: volunteerEmail,
      subject: `🎯 Assignment Invitation: ${taskTitle} — Slot ${progress}`,
      html,
      text: `Hi ${volunteerName}, You've been invited to volunteer for: ${taskTitle}. Slot ${progress}. Duration: ${durationDays} days. Approve or reject via the links in this email.`,
    }

    const info = await transporter.sendMail(mailOptions)
    console.log(`📧 Assignment email sent to ${volunteerEmail}: ${info.messageId}`)
    return { success: true, messageId: info.messageId }

  } catch (error) {
    console.error(`❌ Assignment email failed to ${volunteerEmail}:`, error.message)
    return { success: false, error: error.message }
  }
}

// ═══════════════════════════════════════════════════════════
// Send Approval Confirmation (volunteer accepted)
// ═══════════════════════════════════════════════════════════
exports.sendApprovalConfirmationEmail = async ({
  volunteerEmail,
  volunteerName,
  taskTitle,
  durationDays,
  slotNumber,
  totalSlots,
  ngoName,
  startDate,
}) => {
  try {
    const progress = `${slotNumber}/${totalSlots}`
    const startDateStr = startDate
      ? new Date(startDate).toLocaleDateString('en-IN', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'To be confirmed'

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#f3f4f6; color:#1f2937; }
          .container { max-width:600px; margin:0 auto; padding:20px; }
          .card { background:white; border-radius:16px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.1); }
          .header { background:linear-gradient(135deg,#10b981,#059669); padding:40px; text-align:center; color:white; }
          .body { padding:32px; }
          .confirmed-box { background:#ecfdf5; border:2px solid #10b981; border-radius:12px; padding:24px; text-align:center; margin:20px 0; }
          .detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:20px 0; }
          .detail-box { background:#f3f4f6; padding:14px; border-radius:10px; }
          .detail-label { font-size:11px; text-transform:uppercase; color:#9ca3af; margin-bottom:6px; letter-spacing:0.5px; }
          .detail-value { font-size:16px; font-weight:700; color:#111827; }
          .footer { text-align:center; padding:24px; border-top:1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">

            <div class="header">
              <div style="font-size:48px;margin-bottom:16px;">🎉</div>
              <h1 style="font-size:26px;font-weight:700;margin-bottom:8px;">Slot Confirmed!</h1>
              <p style="opacity:0.9;font-size:15px;">Thank you for accepting the assignment</p>
            </div>

            <div class="body">
              <p style="font-size:16px;margin-bottom:20px;">
                Hi <strong>${volunteerName}</strong>,
              </p>
              <p style="font-size:14px;color:#6b7280;margin-bottom:8px;">
                Your slot is confirmed for <strong>${taskTitle}</strong>!
              </p>

              <div class="confirmed-box">
                <p style="font-size:36px;font-weight:700;color:#059669;">${progress}</p>
                <p style="font-size:14px;color:#065f46;margin-top:6px;">Your Confirmed Slot</p>
              </div>

              <div class="detail-grid">
                <div class="detail-box">
                  <div class="detail-label">📅 Start Date</div>
                  <div class="detail-value" style="font-size:13px;">${startDateStr}</div>
                </div>
                <div class="detail-box">
                  <div class="detail-label">⏱️ Duration</div>
                  <div class="detail-value">${durationDays} days</div>
                </div>
                <div class="detail-box">
                  <div class="detail-label">🏢 Organization</div>
                  <div class="detail-value" style="font-size:13px;">${ngoName}</div>
                </div>
                <div class="detail-box">
                  <div class="detail-label">👥 Progress</div>
                  <div class="detail-value">${progress}</div>
                </div>
              </div>

              <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:14px 18px;border-radius:4px;margin:16px 0;font-size:13px;color:#92400e;">
                📌 <strong>Important:</strong> Please be available on the start date.
                More details about the location will be sent closer to the date.
              </div>

              <p style="font-size:14px;color:#6b7280;text-align:center;margin-top:20px;">
                🙏 Thank you for your dedication to serving the community!
              </p>
            </div>

            <div class="footer">
              <p style="font-size:12px;color:#9ca3af;">© ${new Date().getFullYear()} NGO Volunteer Platform</p>
            </div>

          </div>
        </div>
      </body>
      </html>
    `

    const mailOptions = {
      from: `"NGO Platform" <${process.env.EMAIL_USER}>`,
      to: volunteerEmail,
      subject: `✅ Confirmed: ${taskTitle} — Slot ${progress}`,
      html,
    }

    const info = await transporter.sendMail(mailOptions)
    console.log(`📧 Confirmation email sent to ${volunteerEmail}`)
    return { success: true, messageId: info.messageId }

  } catch (error) {
    console.error(`❌ Confirmation email failed:`, error.message)
    return { success: false, error: error.message }
  }
}

// ═══════════════════════════════════════════════════════════
// Send Rejection Notification (volunteer declined)
// ═══════════════════════════════════════════════════════════
exports.sendRejectionNotificationEmail = async ({
  volunteerEmail,
  volunteerName,
  taskTitle,
  ngoName,
}) => {
  try {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#f3f4f6; color:#1f2937; }
          .container { max-width:600px; margin:0 auto; padding:20px; }
          .card { background:white; border-radius:16px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.1); }
          .header { background:linear-gradient(135deg,#6b7280,#4b5563); padding:40px; text-align:center; color:white; }
          .body { padding:32px; }
          .footer { text-align:center; padding:24px; border-top:1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">

            <div class="header">
              <div style="font-size:48px;margin-bottom:16px;">👋</div>
              <h1 style="font-size:22px;font-weight:700;">No Problem!</h1>
              <p style="opacity:0.9;font-size:14px;">We understand you can't make it this time</p>
            </div>

            <div class="body">
              <p style="font-size:15px;margin-bottom:16px;">
                Hi <strong>${volunteerName}</strong>,
              </p>
              <p style="font-size:14px;color:#6b7280;margin-bottom:16px;">
                Thanks for letting us know you can't help with <strong>${taskTitle}</strong>.
                We've opened your slot for another volunteer.
              </p>
              <p style="font-size:14px;color:#6b7280;margin-bottom:16px;">
                We'd love to have you on a future opportunity with <strong>${ngoName}</strong>!
                Keep checking your dashboard for new tasks.
              </p>
              <p style="font-size:14px;color:#6b7280;">
                Thank you for being part of our volunteer community! 💙
              </p>
            </div>

            <div class="footer">
              <p style="font-size:12px;color:#9ca3af;">© ${new Date().getFullYear()} NGO Volunteer Platform</p>
            </div>

          </div>
        </div>
      </body>
      </html>
    `

    const mailOptions = {
      from: `"NGO Platform" <${process.env.EMAIL_USER}>`,
      to: volunteerEmail,
      subject: `Regarding: ${taskTitle}`,
      html,
    }

    await transporter.sendMail(mailOptions)
    console.log(`📧 Rejection notification sent to ${volunteerEmail}`)
    return { success: true }

  } catch (error) {
    console.error(`❌ Rejection notification failed:`, error.message)
    return { success: false, error: error.message }
  }
}