(() => {
  'use strict';
  if (window.DominionDevicePreferenceLocality) return;

  const patch = async () => {
    try {
      const client = await window.DSAuth?.init?.();
      if (!client || client.__dsDevicePreferenceLocality) return Boolean(client);
      const originalFrom = client.from?.bind(client);
      if (!originalFrom) return false;

      client.from = table => {
        const builder = originalFrom(table);
        if (table !== 'meet_user_preferences' || !builder?.upsert || builder.__dsDevicePreferenceLocality) return builder;
        const originalUpsert = builder.upsert.bind(builder);
        builder.upsert = (payload, ...args) => {
          if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return originalUpsert(payload, ...args);
          const sanitized = {...payload};
          delete sanitized.camera_id;
          delete sanitized.microphone_id;
          delete sanitized.speaker_id;
          return originalUpsert(sanitized, ...args);
        };
        builder.__dsDevicePreferenceLocality = true;
        return builder;
      };
      client.__dsDevicePreferenceLocality = true;
      return true;
    } catch {
      return false;
    }
  };

  void patch();
  window.DominionDevicePreferenceLocality = Object.freeze({
    version:'1.0.0',
    patch
  });
})();
