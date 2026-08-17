
(async () => {
  const gate = document.getElementById('founderAppointmentGate');
  const app = document.getElementById('founderAppointmentApp');
  const list = document.getElementById('founderAppointmentList');
  const filter = document.getElementById('appointmentStatusFilter');

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));

  if (!window.DSAuth?.ready) {
    gate.innerHTML = '<h1>Authentication configuration is missing.</h1>';
    return;
  }

  const supabase = await window.DSAuth.init();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    location.href='/member-login/';
    return;
  }

  const permission = await supabase.rpc('is_dominionstar_founder');
  if (permission.error || !permission.data) {
    gate.innerHTML = '<p class="eyebrow">Restricted</p><h1>Founder access required.</h1>';
    return;
  }

  gate.classList.add('member-hidden');
  app.classList.remove('member-hidden');

  async function loadAppointments() {
    list.innerHTML='<p>Loading appointment requests…</p>';

    const { data: appointmentData, error } = await supabase
      .rpc('founder_list_appointments');

    const data = (appointmentData || [])
      .filter(item => !filter.value || item.status === filter.value)
      .sort((a,b) => {
        const requested = String(a.requested_date || '').localeCompare(String(b.requested_date || ''));
        return requested || new Date(a.created_at) - new Date(b.created_at);
      });

    if (error) {
      list.innerHTML=`<p>${esc(error.message)}</p>`;
      return;
    }

    list.innerHTML = data.length ? data.map(item => {
      const member = {
        full_name: item.member_full_name,
        preferred_name: item.member_preferred_name,
        email: item.member_email,
        agent_code: item.member_agent_code,
        rank: item.member_rank
      };
      const localStart = item.confirmed_start
        ? new Date(item.confirmed_start).toISOString().slice(0,16)
        : '';

      return `
      <article class="founder-appointment-card" data-id="${item.id}">
        <div class="founder-appointment-member">
          <span class="appointment-status ${esc(item.status)}">${esc(item.status)}</span>
          <h3>${esc(member.preferred_name || member.full_name || 'Member')}</h3>
          <p>${esc(member.email || '')}</p>
          <small>${esc(member.rank || 'TA')} · Agent Code ${esc(member.agent_code || '—')}</small>
        </div>

        <div class="founder-appointment-request">
          <p><strong>Requested:</strong> ${esc(item.requested_date)} · ${esc(item.requested_time_window)}</p>
          <p><strong>Type:</strong> ${esc(item.meeting_type.replace(/-/g,' '))}</p>
          <p><strong>Time zone:</strong> ${esc(item.timezone)}</p>
          ${item.notes ? `<p><strong>Member note:</strong> ${esc(item.notes)}</p>` : ''}
        </div>

        <div class="founder-appointment-controls">
          <label>Status
            <select class="appointment-status-select">
              ${['pending','confirmed','rescheduled','completed','cancelled'].map(value =>
                `<option value="${value}" ${item.status===value?'selected':''}>${value}</option>`
              ).join('')}
            </select>
          </label>

          <label>Confirmed Start
            <input class="appointment-start-input" type="datetime-local" value="${localStart}">
          </label>

          <label>Duration
            <select class="appointment-duration-select">
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60" selected>60 minutes</option>
              <option value="90">90 minutes</option>
            </select>
          </label>

          <label>Meeting Location / Link
            <input class="appointment-location-input" value="${esc(item.meeting_location || '')}" placeholder="Zoom link, phone, or office">
          </label>

          <label>Founder Note
            <textarea class="appointment-note-input" rows="3">${esc(item.founder_notes || '')}</textarea>
          </label>

          <button class="btn btn-gold save-appointment" type="button">Save Appointment</button>
          <div class="member-message appointment-save-result"></div>
        </div>
      </article>`;
    }).join('') : '<div class="member-empty-state"><h2>No matching appointment requests.</h2></div>';

    list.querySelectorAll('.save-appointment').forEach(button => {
      button.addEventListener('click', async () => {
        const card = button.closest('.founder-appointment-card');
        const result = card.querySelector('.appointment-save-result');
        const startValue = card.querySelector('.appointment-start-input').value;
        const duration = Number(card.querySelector('.appointment-duration-select').value);

        const startDate = startValue ? new Date(startValue) : null;
        const endDate = startDate ? new Date(startDate.getTime() + duration * 60000) : null;

        button.disabled=true;
        button.textContent='Saving…';

        const { error } = await supabase.rpc('founder_update_appointment',{
          target_appointment_id:card.dataset.id,
          new_status:card.querySelector('.appointment-status-select').value,
          new_confirmed_start:startDate ? startDate.toISOString() : null,
          new_confirmed_end:endDate ? endDate.toISOString() : null,
          new_meeting_location:card.querySelector('.appointment-location-input').value.trim() || null,
          new_founder_notes:card.querySelector('.appointment-note-input').value.trim() || null
        });

        button.disabled=false;
        button.textContent='Save Appointment';
        result.textContent=error ? error.message : 'Appointment updated and member notified.';
        result.className=`member-message show ${error?'error':'success'}`;

        if (!error) { await supabase.rpc('queue_appointment_email',{target_appointment_id:card.dataset.id}); await loadAppointments(); }
      });
    });
  }

  filter.addEventListener('change',loadAppointments);
  document.getElementById('refreshFounderAppointments').addEventListener('click',loadAppointments);

  await loadAppointments();
})();
