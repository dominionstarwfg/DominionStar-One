(() => {
  const listeners = new Map();
  let client = null;
  let session = null;
  let channel = null;

  const emit = (type, event) => {
    [...(listeners.get(type) || []), ...(listeners.get('*') || [])].forEach(handler => {
      try { handler(event); } catch (error) { console.error(error); }
    });
    window.dispatchEvent(new CustomEvent('dominionstar:event', {detail:event}));
  };

  const init = async () => {
    if (client && session) return {client, session};
    if (!window.DSAuth?.ready) throw new Error('DominionStar authentication is unavailable.');
    client = await window.DSAuth.init();
    session = (await client.auth.getSession()).data.session;
    if (!session) throw new Error('An authenticated member session is required.');

    channel ||= client.channel(`executive-events-${session.user.id}`)
      .on('postgres_changes', {
        event:'INSERT', schema:'public', table:'executive_events',
        filter:`member_id=eq.${session.user.id}`
      }, payload => emit(payload.new.event_type, payload.new))
      .subscribe();

    return {client, session};
  };

  const publish = async (eventType, data = {}) => {
    const {client, session} = await init();
    const result = await client.from('executive_events').insert({
      event_type:eventType,
      member_id:data.member_id || session.user.id,
      actor_id:data.actor_id || session.user.id,
      title:data.title || eventType,
      description:data.description || '',
      payload:data.payload || {}
    }).select().single();

    if (result.error) throw result.error;
    emit(eventType, result.data);
    return result.data;
  };

  const on = (type, handler) => {
    const handlers = listeners.get(type) || [];
    handlers.push(handler);
    listeners.set(type, handlers);
    return () => listeners.set(type, (listeners.get(type) || []).filter(item => item !== handler));
  };

  const list = async ({limit = 20, eventType = ''} = {}) => {
    const {client, session} = await init();
    let query = client.from('executive_events').select('*')
      .eq('member_id', session.user.id)
      .order('created_at', {ascending:false})
      .limit(limit);
    if (eventType) query = query.eq('event_type', eventType);
    const result = await query;
    if (result.error) throw result.error;
    return result.data || [];
  };

  window.ExecutiveCore = {init, publish, on, list};
})();
