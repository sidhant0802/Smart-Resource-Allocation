const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

// ── Send single email ────────────────────────────────────────
exports.sendEmail = async ({ to, subject, html, text }) => {
  try {
    const mailOptions = {
      from: `"NGO Platform" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: html || text,
      text: text || '',
    }

    const info = await transporter.sendMail(mailOptions)
    console.log(`📧 Email sent to ${to}: ${info.messageId}`)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error(`❌ Email failed to ${to}:`, error.message)
    return { success: false, error: error.message }
  }
}

// ── Send task notification to multiple volunteers ────────────
exports.sendTaskNotificationToVolunteers = async (task, volunteers) => {
  const results = []

  const emailPromises = volunteers.map(async (volunteer) => {
    try {
      const distanceText = volunteer.distance
        ? `📏 ${volunteer.distance} km from your location`
        : ''

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f4f4f5; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .card { background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #7c3aed, #4f46e5); padding: 30px; text-align: center; color: white; }
            .header h1 { margin: 0; font-size: 24px; }
            .header p { margin: 8px 0 0; opacity: 0.9; font-size: 14px; }
            .body { padding: 30px; }
            .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-right: 8px; }
            .badge-urgent { background: #fef2f2; color: #dc2626; }
            .badge-category { background: #eff6ff; color: #2563eb; }
            .badge-location { background: #f0fdf4; color: #16a34a; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0; }
            .info-box { background: #f9fafb; border-radius: 12px; padding: 16px; }
            .info-box label { font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
            .info-box p { font-size: 18px; font-weight: 700; color: #1f2937; margin: 4px 0 0; }
            .description { background: #f8fafc; border-left: 4px solid #7c3aed; padding: 16px; border-radius: 0 12px 12px 0; margin: 20px 0; }
            .cta { text-align: center; margin: 30px 0 10px; }
            .cta a { display: inline-block; background: linear-gradient(135deg, #7c3aed, #4f46e5); color: white; text-decoration: none; padding: 14px 40px; border-radius: 12px; font-weight: 600; font-size: 16px; }
            .skills { margin: 16px 0; }
            .skill-tag { display: inline-block; background: #eef2ff; color: #4338ca; padding: 4px 10px; border-radius: 8px; font-size: 12px; margin: 2px 4px 2px 0; }
            .footer { text-align: center; padding: 20px; color: #9ca3af; font-size: 12px; }
            .distance-badge { background: #fef3c7; color: #d97706; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; display: inline-block; margin-top: 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="card">
              <div class="header">
                <h1>🆕 New Task Available!</h1>
                <p>A new volunteer opportunity is waiting for you</p>
              </div>
              <div class="body">
                <h2 style="margin: 0 0 12px; color: #1f2937; font-size: 22px;">
                  ${task.title}
                </h2>

                <div style="margin-bottom: 16px;">
                  <span class="badge badge-category">📂 ${task.category}</span>
                  ${task.urgencyScore >= 70 ? '<span class="badge badge-urgent">🔥 URGENT</span>' : ''}
                  ${task.locationName ? `<span class="badge badge-location">📍 ${task.locationName}</span>` : ''}
                </div>

                ${distanceText ? `<div class="distance-badge">${distanceText}</div>` : ''}

                ${task.description ? `
                  <div class="description">
                    <p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.6;">
                      ${task.description}
                    </p>
                  </div>
                ` : ''}

                <div class="info-grid">
                  <div class="info-box">
                    <label>📅 Duration</label>
                    <p>${task.duration} days</p>
                    <span style="font-size: 11px; color: #9ca3af;">
                      ${new Date(task.startDate).toLocaleDateString()} → ${new Date(task.endDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div class="info-box">
                    <label>👥 Volunteers Needed</label>
                    <p>${task.volunteersNeeded}</p>
                  </div>
                  <div class="info-box">
                    <label>⚡ Urgency Score</label>
                    <p>${task.urgencyScore}/100</p>
                  </div>
                  <div class="info-box">
                    <label>👤 Affected People</label>
                    <p>${task.affectedPeople || 'N/A'}</p>
                  </div>
                </div>

                ${task.skillsRequired && task.skillsRequired.length > 0 ? `
                  <div class="skills">
                    <p style="font-size: 13px; color: #6b7280; margin: 0 0 8px;">🛠️ Skills Required:</p>
                    ${task.skillsRequired.map(s => `<span class="skill-tag">${s}</span>`).join('')}
                  </div>
                ` : ''}

                <div class="cta">
                  <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard/volunteer">
                    🙋 Apply for This Task →
                  </a>
                </div>

                <p style="text-align: center; font-size: 12px; color: #9ca3af; margin-top: 16px;">
                  Log in to your volunteer dashboard to apply. First come, first served!
                </p>
              </div>
              <div class="footer">
                <p>You received this because you're a verified volunteer near the task area.</p>
                <p>© ${new Date().getFullYear()} NGO Platform</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `

      const result = await exports.sendEmail({
        to: volunteer.email,
        subject: `🆕 New Task: ${task.title} — ${task.category} (${task.duration} days)`,
        html,
      })

      results.push({
        volunteerId: volunteer._id,
        email: volunteer.email,
        fullName: volunteer.fullName,
        distance: volunteer.distance,
        ...result,
      })
    } catch (error) {
      console.error(`❌ Failed to notify ${volunteer.email}:`, error.message)
      results.push({
        volunteerId: volunteer._id,
        email: volunteer.email,
        success: false,
        error: error.message,
      })
    }
  })

  await Promise.allSettled(emailPromises)

  const sent = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length
  console.log(`📧 Task notifications: ${sent} sent, ${failed} failed out of ${results.length}`)

  return { total: results.length, sent, failed, details: results }
}

// ── Send task assignment confirmation ────────────────────────
exports.sendTaskAssignmentEmail = async (volunteer, task) => {
  try {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f4f4f5; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .card { background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #059669, #10b981); padding: 30px; text-align: center; color: white; }
          .body { padding: 30px; }
          .footer { text-align: center; padding: 20px; color: #9ca3af; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <h1>✅ You've Been Approved!</h1>
              <p>Your task application has been accepted</p>
            </div>
            <div class="body">
              <h2 style="color: #1f2937;">${task.title}</h2>
              <p style="color: #6b7280;">📂 ${task.category} • 📅 ${task.duration} days</p>
              <p style="color: #6b7280;">📍 ${task.locationName || 'Location TBD'}</p>
              <p style="color: #6b7280;">
                🗓️ ${new Date(task.startDate).toLocaleDateString()} → ${new Date(task.endDate).toLocaleDateString()}
              </p>
              <div style="background: #f0fdf4; border-radius: 12px; padding: 16px; margin: 20px 0; text-align: center;">
                <p style="color: #166534; font-weight: 600; margin: 0;">
                  Please report to the task location on the start date.
                </p>
              </div>
              <div style="text-align: center; margin-top: 20px;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard/volunteer"
                   style="display: inline-block; background: #059669; color: white; padding: 12px 30px; border-radius: 12px; text-decoration: none; font-weight: 600;">
                  View Task Details →
                </a>
              </div>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} NGO Platform</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `

    return await exports.sendEmail({
      to: volunteer.email,
      subject: `✅ Approved: ${task.title} — Start ${new Date(task.startDate).toLocaleDateString()}`,
      html,
    })
  } catch (error) {
    console.error('Assignment email error:', error)
    return { success: false, error: error.message }
  }
}