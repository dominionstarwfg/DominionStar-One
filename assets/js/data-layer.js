window.DSData = (() => {
  const cache = new Map();

  const unique = values => [...new Set((values || []).filter(Boolean))];

  async function fetchByIds(client, table, ids, columns = '*', idColumn = 'id') {
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

  async function fetchProfiles(client, ids, columns = 'id,full_name,preferred_name,email,agent_code,rank,exclusive_member_number,avatar_path,verification_status') {
    return fetchByIds(client, 'member_profiles', ids, columns, 'id');
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
