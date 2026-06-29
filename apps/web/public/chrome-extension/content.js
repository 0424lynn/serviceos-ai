const BASE_URL = 'https://service-atosa.netlify.app'
let accessToken = ''
let currentTone = 'professional'
let generatedReply = ''
let panelOpen = true

// Wait for Gmail to load
function waitForGmail(callback) {
  const check = setInterval(() => {
    if (document.querySelector('[role="main"]')) {
      clearInterval(check)
      callback()
    }
  }, 500)
}

function createPanel() {
  // Toggle button
  const toggle = document.createElement('button')
  toggle.id = 'serviceos-toggle'
  toggle.className = 'panel-open'
  toggle.textContent = 'ServiceOS'
  toggle.onclick = togglePanel
  document.body.appendChild(toggle)

  // Main panel
  const panel = document.createElement('div')
  panel.id = 'serviceos-panel'
  panel.innerHTML = `
    <div class="sos-header">
      <img class="sos-header-logo" src="${chrome.runtime.getURL('icon.png')}" alt="S" onerror="this.style.display='none'" />
      <div>
        <div class="sos-header-title">ServiceOS.ai</div>
        <div class="sos-header-sub">AI Service Assistant</div>
      </div>
    </div>

    <div id="sos-login-view" class="sos-body sos-login">
      <p style="color:#666;font-size:12px;margin-bottom:10px">Sign in to ServiceOS.ai</p>
      <input type="email" id="sos-email" placeholder="Email" />
      <input type="password" id="sos-password" placeholder="Password" />
      <button class="sos-btn sos-btn-primary" onclick="sosLogin()">Sign in</button>
      <div class="sos-error" id="sos-login-error"></div>
    </div>

    <div id="sos-main-view" style="display:none;flex:1;display:none;flex-direction:column;overflow:hidden">
      <div class="sos-body">
        <div class="sos-tabs">
          <button class="sos-tab active" onclick="sosSwitchTab('analyze')" id="sos-tab-analyze">Analyze</button>
          <button class="sos-tab" onclick="sosSwitchTab('reply')" id="sos-tab-reply">Reply</button>
        </div>

        <!-- Analyze tab -->
        <div id="sos-panel-analyze">
          <button class="sos-btn sos-btn-primary" onclick="sosAnalyze()" id="sos-btn-analyze">⚡ Analyze Email</button>
          <div id="sos-analyze-loading" style="display:none" class="sos-loading">
            <div class="sos-spinner"></div><br>Analyzing…
          </div>
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
              <div style="font-size:12px;color:#555;line-height:1.5" id="sos-r-notes">—</div>
            </div>
          </div>
        </div>

        <!-- Reply tab -->
        <div id="sos-panel-reply" style="display:none">
          <div style="font-size:10px;color:#888;margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px">Tone</div>
          <div class="sos-tone-row">
            <button class="sos-tone active" onclick="sosSetTone(this,'professional')">Professional</button>
            <button class="sos-tone" onclick="sosSetTone(this,'friendly')">Friendly</button>
            <button class="sos-tone" onclick="sosSetTone(this,'short')">Short</button>
            <button class="sos-tone" onclick="sosSetTone(this,'detailed')">Detailed</button>
          </div>
          <button class="sos-btn sos-btn-primary" onclick="sosReply()" id="sos-btn-reply">✉ Generate Reply</button>
          <div id="sos-reply-loading" style="display:none" class="sos-loading">
            <div class="sos-spinner"></div><br>Generating…
          </div>
          <div id="sos-reply-result" style="display:none">
            <div class="sos-reply-box" id="sos-reply-text"></div>
            <button class="sos-btn sos-btn-green" onclick="sosCopyReply()">📋 Copy Reply</button>
          </div>
        </div>
      </div>

      <div class="sos-footer">
        <button class="sos-signout" onclick="sosLogout()">Sign out</button>
      </div>
    </div>
  `
  document.body.appendChild(panel)

  // Check saved token
  chrome.storage.local.get(['sos_token'], (result) => {
    if (result.sos_token) {
      accessToken = result.sos_token
      sosShowMain()
    } else {
      sosShowLogin()
    }
  })
}

function togglePanel() {
  const panel = document.getElementById('serviceos-panel')
  const toggle = document.getElementById('serviceos-toggle')
  panelOpen = !panelOpen
  panel.classList.toggle('hidden', !panelOpen)
  toggle.classList.toggle('panel-open', panelOpen)
}

function sosShowLogin() {
  document.getElementById('sos-login-view').style.display = 'block'
  document.getElementById('sos-main-view').style.display = 'none'
}

function sosShowMain() {
  document.getElementById('sos-login-view').style.display = 'none'
  document.getElementById('sos-main-view').style.display = 'flex'
}

window.sosLogin = async function() {
  const email = document.getElementById('sos-email').value
  const password = document.getElementById('sos-password').value
  document.getElementById('sos-login-error').textContent = ''

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
      sosShowMain()
    } else {
      document.getElementById('sos-login-error').textContent = data.error?.message || 'Login failed'
    }
  } catch {
    document.getElementById('sos-login-error').textContent = 'Network error'
  }
}

window.sosLogout = function() {
  chrome.storage.local.remove('sos_token')
  accessToken = ''
  sosShowLogin()
}

window.sosSwitchTab = function(tab) {
  document.getElementById('sos-panel-analyze').style.display = tab === 'analyze' ? 'block' : 'none'
  document.getElementById('sos-panel-reply').style.display = tab === 'reply' ? 'block' : 'none'
  document.getElementById('sos-tab-analyze').className = 'sos-tab' + (tab === 'analyze' ? ' active' : '')
  document.getElementById('sos-tab-reply').className = 'sos-tab' + (tab === 'reply' ? ' active' : '')
}

window.sosSetTone = function(btn, tone) {
  document.querySelectorAll('.sos-tone').forEach(b => b.className = 'sos-tone')
  btn.className = 'sos-tone active'
  currentTone = tone
}

function getEmailBody() {
  // Try to get the open email body from Gmail DOM
  const selectors = [
    '[data-message-id] .a3s',
    '.ii.gt .a3s',
    '[role="main"] .a3s.aiL',
    '.gs .ii.gt div[dir]',
  ]
  for (const sel of selectors) {
    const el = document.querySelector(sel)
    if (el && el.innerText.trim()) return el.innerText.trim()
  }
  return ''
}

window.sosAnalyze = async function() {
  const btn = document.getElementById('sos-btn-analyze')
  const body = getEmailBody()
  if (!body) { alert('Please open an email first.'); return }

  btn.disabled = true
  document.getElementById('sos-analyze-loading').style.display = 'block'
  document.getElementById('sos-analyze-result').style.display = 'none'

  try {
    const res = await fetch(`${BASE_URL}/api/v1/apps/ticket-assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({ customer_description: body })
    })
    const data = await res.json()
    if (data.success && data.data) {
      const d = data.data
      document.getElementById('sos-r-model').textContent = d.model || '—'
      document.getElementById('sos-r-serial').textContent = d.serial_number || '—'
      document.getElementById('sos-r-problem').textContent = d.issue_summary || '—'
      document.getElementById('sos-r-category').textContent = d.problem_category || '—'
      document.getElementById('sos-r-nextstep').textContent = d.suggested_next_step || '—'
      document.getElementById('sos-r-notes').textContent = d.technician_notes || '—'
      document.getElementById('sos-analyze-result').style.display = 'block'
    }
  } catch { alert('Analysis failed.') }

  document.getElementById('sos-analyze-loading').style.display = 'none'
  btn.disabled = false
}

window.sosReply = async function() {
  const btn = document.getElementById('sos-btn-reply')
  const body = getEmailBody()
  if (!body) { alert('Please open an email first.'); return }

  btn.disabled = true
  document.getElementById('sos-reply-loading').style.display = 'block'
  document.getElementById('sos-reply-result').style.display = 'none'

  try {
    const res = await fetch(`${BASE_URL}/api/v1/apps/email-assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({ original_email: body, tone: currentTone })
    })
    const data = await res.json()
    if (data.success && data.data?.reply) {
      generatedReply = data.data.reply
      document.getElementById('sos-reply-text').textContent = generatedReply
      document.getElementById('sos-reply-result').style.display = 'block'
    }
  } catch { alert('Failed to generate reply.') }

  document.getElementById('sos-reply-loading').style.display = 'none'
  btn.disabled = false
}

window.sosCopyReply = function() {
  navigator.clipboard.writeText(generatedReply)
  const btn = event.target
  btn.textContent = '✓ Copied!'
  setTimeout(() => btn.textContent = '📋 Copy Reply', 2000)
}

waitForGmail(createPanel)
