
(() => {
  const config = window.DOMINIONSTAR_SUPABASE || {};
  const configured = Boolean(
    config.url && config.anonKey &&
    !String(config.url).includes('REPLACE_') &&
    !String(config.anonKey).includes('REPLACE_')
  );

  async function loadSupabaseLibrary() {
    if (window.supabase?.createClient) return true;

    const sources = [
      'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
      'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js'
    ];

    for (const source of sources) {
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = source;
          script.async = true;
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
        if (window.supabase?.createClient) return true;
      } catch (error) {
        console.warn('Supabase library source failed:', source, error);
      }
    }

    return false;
  }


  const loadGlobalCallManager = () => {
    if (window.DominionStarGlobalCallManager || document.querySelector('script[data-ds-global-call-manager]')) return;
    const script = document.createElement('script');
    script.src = '/assets/js/global-call-manager.js?v=9.0-executive-3.0-rc2';
    script.async = true;
    script.dataset.dsGlobalCallManager = 'true';
    document.head.appendChild(script);
  };

  window.DSAuth = {
    ready: configured,
    client: null,
    async init() {
      if (!configured) return null;
      if (this.client) return this.client;

      const loaded = await loadSupabaseLibrary();
      if (!loaded) return null;

      this.client = window.supabase.createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      loadGlobalCallManager();
      return this.client;
    },
    async getSession() {
      const client = await this.init();
      return client ? (await client.auth.getSession()).data.session : null;
    },
    async signOut() {
      const client = await this.init();
      if (client) await client.auth.signOut();
      window.location.href = '/member-login/';
    }
  };
})();
