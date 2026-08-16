
(async () => {
  const gate = document.getElementById('appointmentGate');
  const app = document.getElementById('appointmentApp');
  const form = document.getElementById('appointmentRequestForm');
  const result = document.getElementById('appointmentRequestResult');
  const list = document.getElementById('memberAppointmentList');
  const dateInput = form?.elements.requested_date;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));

  function show(text, type='info') {
    result.textContent = text;
    result.className = `member-message show ${type}`;
  }

  if (!window.DSAuth?.ready) {
    gate.innerHTML = '<p class="eyebrow">Unavailable</p><h1>Authentication configuration is missing.</h1>';
    return;
  }

  const supabase = await window.DSAuth.init();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    location.href = '/member-login/';
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from('member_profiles')
    .select('verification_status')
    .eq('id',session.user.id)
    .single();

  if (profileError || profile?.verification_status !== 'approved') {
    gate.innerHTML = '<p class="eyebrow">Founder Approval Required</p><h1>Appointment access is available to approved members.</h1>';
    return;
  }

  gate.classList.add('member-hidden');
  app.classList.remove('member-hidden');

  if (dateInput) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateInput.min = tomorrow.toISOString().split('T')[0];
  }

  async function loadAppointments() {
    list.innerHTML = '<p>Loading appointments…</p>';

    const { data, error } = await supabase
      .from('member_appointments')
      .select('*')
      .eq('member_id',session.user.id)
      .order('created_at',{ascending:false});

    if (error) {
      list.innerHTML = `<p>${esc(error.message)}</p>`;
      return;
    }

    list.innerHTML = data.length ? data.map(item => {
      const confirmed = item.confirmed_start
        ? new Date(item.confirmed_start).toLocaleString()
        : 'Awaiting Founder confirmation';

      return `
      <article class="appointment-card">
        <div class="appointment-card-head">
          <div>
            <span class="appointment-status ${esc(item.status)}">${esc(item.status)}</span>
            <h3>${esc(item.meeting_type.replace(/-/g,' '))}</h3>
          </div>
          <small>Requested ${new Date(item.created_at).toLocaleDateString()}</small>
        </div>
        <dl>
          <div><dt>Preferred date</dt><dd>${esc(item.requested_date)}</dd></div>
          <div><dt>Preferred window</dt><dd>${esc(item.requested_time_window)}</dd></div>
          <div><dt>Confirmed</dt><dd>${esc(confirmed)}</dd></div>
          <div><dt>Location</dt><dd>${esc(item.meeting_location || 'To be provided')}</dd></div>
        </dl>
        ${item.notes ? `<p><strong>Your notes:</strong> ${esc(item.notes)}</p>` : ''}
        ${item.founder_notes ? `<p><strong>Founder note:</strong> ${esc(item.founder_notes)}</p>` : ''}
        ${['pending','confirmed','rescheduled'].includes(item.status)
          ? `<button class="btn btn-outline cancel-appointment" data-id="${item.id}" type="button">Cancel Request</button>`
          : ''}
      </article>`;
    }).join('') : '<div class="member-empty-state"><h2>No appointment requests yet.</h2><p>Your requests will appear here.</p></div>';

    list.querySelectorAll('.cancel-appointment').forEach(button => {
      button.addEventListener('click', async () => {
        if (!confirm('Cancel this appointment request?')) return;

        button.disabled = true;
        const { error } = await supabase
          .from('member_appointments')
          .update({ status:'cancelled', updated_at:new Date().toISOString() })
          .eq('id',button.dataset.id)
          .eq('member_id',session.user.id);

        if (error) alert(error.message);
        await loadAppointments();
      });
    });
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const button = document.getElementById('appointmentRequestSubmit');
    button.disabled = true;
    button.textContent = 'Submitting…';
    show('Sending appointment request…','info');

    const { error } = await supabase.from('member_appointments').insert({
      member_id:session.user.id,
      requested_date:form.requested_date.value,
      requested_time_window:form.requested_time_window.value,
      meeting_type:form.meeting_type.value,
      timezone:form.timezone.value,
      notes:form.notes.value.trim() || null
    });

    button.disabled = false;
    button.textContent = 'Request Appointment';

    if (error) {
      show(error.message,'error');
      return;
    }

    form.reset();
    if (dateInput) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateInput.min = tomorrow.toISOString().split('T')[0];
    }

    show('Appointment request submitted. You will receive an in-platform notification when it is confirmed.','success');
    await loadAppointments();
  });

  document.getElementById('refreshAppointments').addEventListener('click',loadAppointments);

  await loadAppointments();
})();
