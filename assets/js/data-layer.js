window.DSData = (() => {
  const cache = new Map();

  const unique = values => [...new Set((values || []).filter(Boolean))];

  async function fetchByIds(client, table, ids, columns = '*', idColumn = 'id') {
    // This generic helper is shared by peer-facing screens. Do not allow an
    // accidental bulk read of the private profile table via a convenience API.
    if(table==='member_profiles')
      throw new Error('Private member profiles cannot be loaded through the shared data helper.');
    const keys = unique(ids);
    if (!keys.length) return {};

    const cacheKey = `${table}:${idColumn}:${columns}:${keys.sort().join(',')}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    const { data, error } = await client
      .from(table)
      .select(columns)
      .in(idColumn, keys);

    if (error) throw error;

    const map = Object.fromEntries(
      (data || []).map(item => [item[idColumn], item])
    );

    cache.set(cacheKey, map);
    return map;
  }

  // Exact allowlist from the approved member_public_profiles schema.
  // Sensitive fields (email, Agent Code, assignments, administrative status
  // and account notes) must never be fetched for another member.
  const shareableProfileColumns=new Set([
    'id','full_name','preferred_name','rank','founding_member',
    'exclusive_member_number','avatar_path','city','state',
    'verification_status'
  ]);
  async function fetchProfiles(client, ids,
    columns = 'id,full_name,preferred_name,rank,exclusive_member_number,avatar_path') {
    // The projection is deliberately not enabled until the coordinated
    // Supabase RLS cutover. During staging preparation, fall back to generic
    // names in peer UI rather than querying raw member_profiles.
    if(window.DOMINIONSTAR_AGENT_DATA_FEATURES?.publicMemberProfilesV2!==true)
      return {};
    const requested=String(columns).split(',').map(s=>s.trim());
    if(!requested.length||requested.some(c=>!shareableProfileColumns.has(c)))
      throw new Error('Requested profile columns are not approved for member directory access.');
    const selected=[...new Set(['id',...requested])].join(',');
    return fetchByIds(client,'member_public_profiles',ids,selected,'id');
  }

  async function mergeProfiles(client, rows, foreignKey = 'user_id', targetKey = 'member_profile') {
    const profileMap = await fetchProfiles(
      client,
      (rows || []).map(row => row[foreignKey])
    );

    return (rows || []).map(row => ({
      ...row,
      [targetKey]: profileMap[row[foreignKey]] || null
    }));
  }

  async function signedUrls(client, bucket, paths, expiresIn = 3600) {
    const keys = unique(paths);
    const pairs = await Promise.all(
      keys.map(async path => {
        const { data, error } = await client.storage
          .from(bucket)
          .createSignedUrl(path, expiresIn);

        return [path, error ? null : data?.signedUrl || null];
      })
    );

    return Object.fromEntries(pairs);
  }

  function clearCache() {
    cache.clear();
  }

  return {
    unique,
    fetchByIds,
    fetchProfiles,
    mergeProfiles,
    signedUrls,
    clearCache
  };
})();
