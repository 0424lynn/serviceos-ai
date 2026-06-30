const BASE_URL = 'https://service-atosa.netlify.app'
let accessToken = ''
let currentTone = 'professional'
let generatedReply = ''

function waitForGmail(callback) {
  const check = setInterval(() => {
    if (document.querySelector('[role="main"]') && !document.getElementById('serviceos-panel')) {
      clearInterval(check)
      callback()
    }
  }, 800)
}

function $(id) { return document.getElementById(id) }

function createPanel() {
  const toggle = document.createElement('button')
  toggle.id = 'serviceos-toggle'
  toggle.className = 'panel-open'
  toggle.textContent = 'ServiceOS'
  document.body.appendChild(toggle)

  const panel = document.createElement('div')
  panel.id = 'serviceos-panel'
  panel.innerHTML = `
    <div class="sos-header">
      <div style="width:22px;height:22px;background:#fff3;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:white">S</div>
      <div>
        <div class="sos-header-title">ServiceOS.ai</div>
        <div class="sos-header-sub">AI Service Assistant</div>
      </div>
    </div>

    <div id="sos-login-view" class="sos-body sos-login">
      <p style="color:#666;font-size:12px;margin-bottom:10px">Sign in to ServiceOS.ai</p>
      <input type="email" id="sos-email" placeholder="Email" />
      <input type="password" id="sos-password" placeholder="Password" style="margin-top:6px" />
      <button id="sos-login-btn" class="sos-btn sos-btn-primary" style="margin-top:8px">Sign in</button>
      <div class="sos-error" id="sos-login-error"></div>
    </div>

    <div id="sos-main-view" style="display:none;flex-direction:column;flex:1;overflow:hidden">
      <div class="sos-body">
        <div class="sos-tabs">
          <button id="sos-tab-analyze" class="sos-tab active">Analyze</button>
          <button id="sos-tab-reply" class="sos-tab">Reply</button>
        </div>

        <div id="sos-panel-analyze">
          <button id="sos-btn-analyze" class="sos-btn sos-btn-primary">⚡ Analyze Email</button>
          <div id="sos-analyze-loading" style="display:none" class="sos-loading"><div class="sos-spinner"></div><br>Analyzing…</div>
          <div id="sos-analyze-result" style="display:none">
            <div class="sos-card">
              <div class="sos-card-title">Extracted Info</div>
              <div class="sos-field"><span class="sos-field-label">Model</span><span class="sos-field-value" id="sos-r-model">—</span></div>
              <div class="sos-field"><span class="sos-field-label">Serial No.</span><span class="sos-field-value" id="sos-r-serial">—</span></div>
              <div class="sos-field"><span class="sos-field-label">Problem</span><span class="sos-field-value" id="sos-r-problem">—</span></div>
              <div class="sos-field"><span class="sos-field-label">Category</span><span class="sos-field-value" id="sos-r-category">—</span></div>
              <div class="sos-field"><span class="sos-field-label">Next Step</span><span class="sos-field-value" id="sos-r-nextstep">—</span></div>
            </div>
            <div class="sos-card">
              <div class="sos-card-title">Technician Notes</div>
              <div id="sos-r-notes" style="font-size:12px;color:#555;line-height:1.5">—</div>
            </div>
          </div>
        </div>

        <div id="sos-panel-reply" style="display:none">
          <div style="font-size:10px;color:#888;margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px">Tone</div>
          <div class="sos-tone-row">
            <button class="sos-tone active" data-tone="professional">Professional</button>
            <button class="sos-tone" data-tone="friendly">Friendly</button>
            <button class="sos-tone" data-tone="short">Short</button>
            <button class="sos-tone" data-tone="detailed">Detailed</button>
          </div>
          <button id="sos-btn-reply" class="sos-btn sos-btn-primary">✉ Generate Reply</button>
          <div id="sos-reply-loading" style="display:none" class="sos-loading"><div class="sos-spinner"></div><br>Generating…</div>
          <div id="sos-reply-result" style="display:none">
            <div class="sos-reply-box" id="sos-reply-text"></div>
            <button id="sos-copy-btn" class="sos-btn sos-btn-green">📋 Copy Reply</button>
          </div>
        </div>
      </div>
      <div class="sos-footer">
        <button id="sos-signout-btn" class="sos-signout">Sign out</button>
      </div>
    </div>
  `
  document.body.appendChild(panel)
  bindEvents()

  chrome.storage.local.get(['sos_token'], (result) => {
    if (result.sos_token) {
      accessToken = result.sos_token
      showMain()
    } else {
      showLogin()
    }
  })
}

function bindEvents() {
  // Toggle panel
  $('serviceos-toggle').addEventListener('click', () => {
    const panel = $('serviceos-panel')
    const toggle = $('serviceos-toggle')
    const hidden = panel.classList.toggle('hidden')
    toggle.classList.toggle('panel-open', !hidden)
  })

  // Login
  $('sos-login-btn').addEventListener('click', doLogin)
  $('sos-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin() })

  // Tabs
  $('sos-tab-analyze').addEventListener('click', () => switchTab('analyze'))
  $('sos-tab-reply').addEventListener('click', () => switchTab('reply'))

  // Analyze
  $('sos-btn-analyze').addEventListener('click', doAnalyze)

  // Reply
  $('sos-btn-reply').addEventListener('click', doReply)
  $('sos-copy-btn').addEventListener('click', doCopy)

  // Sign out
  $('sos-signout-btn').addEventListener('click', doLogout)

  // Tone buttons
  document.querySelectorAll('.sos-tone').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sos-tone').forEach(b => b.className = 'sos-tone')
      btn.className = 'sos-tone active'
      currentTone = btn.dataset.tone
    })
  })
}

function showLogin() {
  $('sos-login-view').style.display = 'block'
  $('sos-main-view').style.display = 'none'
}

function showMain() {
  $('sos-login-view').style.display = 'none'
  $('sos-main-view').style.display = 'flex'
}

function switchTab(tab) {
  $('sos-panel-analyze').style.display = tab === 'analyze' ? 'block' : 'none'
  $('sos-panel-reply').style.display = tab === 'reply' ? 'block' : 'none'
  $('sos-tab-analyze').className = 'sos-tab' + (tab === 'analyze' ? ' active' : '')
  $('sos-tab-reply').className = 'sos-tab' + (tab === 'reply' ? ' active' : '')
}

async function doLogin() {
  const email = $('sos-email').value.trim()
  const password = $('sos-password').value
  $('sos-login-error').textContent = ''
  $('sos-login-btn').disabled = true
  $('sos-login-btn').textContent = 'Signing in…'

  try {
    const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    if (data.success && data.data?.session?.access_token) {
      accessToken = data.data.session.access_token
      chrome.storage.local.set({ sos_token: accessToken })
      showMain()
    } else {
      $('sos-login-error').textContent = data.error?.message || 'Login failed'
    }
  } catch(e) {
    $('sos-login-error').textContent = 'Network error: ' + e.message
  }

  $('sos-login-btn').disabled = false
  $('sos-login-btn').textContent = 'Sign in'
}

function doLogout() {
  chrome.storage.local.remove('sos_token')
  accessToken = ''
  showLogin()
}

function getEmailBody() {
  // Collect ALL expanded messages in the Gmail thread
  const parts = []
  const messages = document.querySelectorAll('.a3s.aiL')
  messages.forEach((el, i) => {
    const text = el.innerText?.trim()
    if (text && text.length > 10) {
      parts.push(i === 0 ? text : `--- Previous message ---\n${text}`)
    }
  })
  if (parts.length > 0) return parts.join('\n\n')

  // Fallback
  for (const sel of ['.ii.gt .a3s', '[data-message-id] .a3s', '.gs .ii.gt div[dir]']) {
    const el = document.querySelector(sel)
    if (el && el.innerText.trim().length > 10) return el.innerText.trim()
  }
  return ''
}

async function doAnalyze() {
  const body = getEmailBody()
  if (!body) { alert('Please open an email first.'); return }
  $('sos-btn-analyze').disabled = true
  $('sos-analyze-loading').style.display = 'block'
  $('sos-analyze-result').style.display = 'none'
  try {
    const res = await fetch(`${BASE_URL}/api/v1/apps/ticket-assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({ customer_description: body })
    })
    const data = await res.json()
    if (data.success && data.data) {
      const d = data.data
      $('sos-r-model').textContent = d.model || '—'
      $('sos-r-serial').textContent = d.serial_number || '—'
      $('sos-r-problem').textContent = d.issue_summary || '—'
      $('sos-r-category').textContent = d.problem_category || '—'
      $('sos-r-nextstep').textContent = d.suggested_next_step || '—'
      $('sos-r-notes').textContent = d.technician_notes || '—'
      $('sos-analyze-result').style.display = 'block'
    }
  } catch(e) { alert('Error: ' + e.message) }
  $('sos-analyze-loading').style.display = 'none'
  $('sos-btn-analyze').disabled = false
}

async function doReply() {
  const body = getEmailBody()
  if (!body) { alert('Please open an email first.'); return }
  $('sos-btn-reply').disabled = true
  $('sos-reply-loading').style.display = 'block'
  $('sos-reply-result').style.display = 'none'
  try {
    const res = await fetch(`${BASE_URL}/api/v1/apps/email-assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({ original_email: body, tone: currentTone })
    })
    const data = await res.json()
    if (data.success && data.data?.reply) {
      generatedReply = data.data.reply
      $('sos-reply-text').textContent = generatedReply
      $('sos-reply-result').style.display = 'block'
    }
  } catch(e) { alert('Error: ' + e.message) }
  $('sos-reply-loading').style.display = 'none'
  $('sos-btn-reply').disabled = false
}

function doCopy() {
  navigator.clipboard.writeText(generatedReply)
  $('sos-copy-btn').textContent = '✓ Copied!'
  setTimeout(() => $('sos-copy-btn').textContent = '📋 Copy Reply', 2000)
}

waitForGmail(createPanel)
