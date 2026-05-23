import type { MindMapMeta, MapData } from '../types/mindmap';
import { getAllMaps, getMapData, saveMapData, createMap as dbCreateMap, updateMapMeta } from '../db/database';
import { ensureRepo, getFile, putFile, listFiles, deleteFile } from './githubApi';
import { useMapStore } from '../store/useMapStore';
import { useTagStore } from '../store/useTagStore';

/** Metadata stored in index.json on GitHub */
interface RemoteMapEntry {
  id: string;
  name: string;
  type: 'mindmap' | 'flowchart';
  updatedAt: string; // ISO string
  createdAt: string; // ISO string
}

interface RemoteIndex {
  version: string;
  maps: RemoteMapEntry[];
}

/** SHA cache to avoid re-reading files just for update */
const shaCache = new Map<string, string>();

function metaToRemoteEntry(meta: MindMapMeta): RemoteMapEntry {
  return {
    id: meta.id,
    name: meta.name,
    type: meta.type,
    updatedAt: meta.updatedAt instanceof Date ? meta.updatedAt.toISOString() : String(meta.updatedAt),
    createdAt: meta.createdAt instanceof Date ? meta.createdAt.toISOString() : String(meta.createdAt),
  };
}

/** Push all local maps to GitHub */
export async function pushToGitHub(token: string, username: string): Promise<string[]> {
  await ensureRepo(token, username);

  const localMaps = await getAllMaps();
  const pushed: string[] = [];

  // Read existing index.json to get SHAs
  const existingIndex = await getFile(token, username, 'index.json');
  const indexSha = existingIndex?.sha;

  // Push each map data
  for (const map of localMaps) {
    const data = await getMapData(map.id);
    if (!data) continue;

    const filePath = `maps/${map.id}.json`;
    const content = JSON.stringify(data, null, 2);

    // Check if file exists to get its SHA
    const cachedSha = shaCache.get(filePath);
    let sha = cachedSha;
    if (!sha) {
      const existing = await getFile(token, username, filePath);
      sha = existing?.sha;
    }

    const newSha = await putFile(
      token,
      username,
      filePath,
      content,
      sha,
      `Sync map: ${map.name}`
    );
    shaCache.set(filePath, newSha);
    pushed.push(map.name);
  }

  // Build and push index.json
  const index: RemoteIndex = {
    version: '1.0',
    maps: localMaps.map(metaToRemoteEntry),
  };

  const indexContent = JSON.stringify(index, null, 2);
  const newIndexSha = await putFile(
    token,
    username,
    'index.json',
    indexContent,
    indexSha || undefined,
    'Update map index'
  );
  shaCache.set('index.json', newIndexSha);

  return pushed;
}

/** Pull all maps from GitHub to local IndexedDB */
export async function pullFromGitHub(token: string, username: string): Promise<string[]> {
  await ensureRepo(token, username);

  // Read index.json
  const indexFile = await getFile(token, username, 'index.json');
  if (!indexFile) {
    // No index.json means no data on remote — nothing to pull
    return [];
  }

  const index: RemoteIndex = JSON.parse(indexFile.content);
  shaCache.set('index.json', indexFile.sha);

  const pulled: string[] = [];

  for (const entry of index.maps) {
    const filePath = `maps/${entry.id}.json`;
    const file = await getFile(token, username, filePath);
    if (!file) continue;

    shaCache.set(filePath, file.sha);

    const mapData: MapData = JSON.parse(file.content);

    // Save to IndexedDB
    await saveMapData(mapData);

    // Upsert map metadata
    const localMaps = await getAllMaps();
    const exists = localMaps.find((m) => m.id === entry.id);
    const meta: MindMapMeta = {
      id: entry.id,
      name: entry.name,
      type: entry.type,
      createdAt: new Date(entry.createdAt),
      updatedAt: new Date(entry.updatedAt),
    };

    if (exists) {
      await updateMapMeta(entry.id, {
        name: meta.name,
        type: meta.type,
        updatedAt: meta.updatedAt,
      });
    } else {
      await dbCreateMap(meta);
    }

    pulled.push(entry.name);
  }

  // Refresh UI stores
  await useMapStore.getState().init();
  await useTagStore.getState().buildTagIndex();

  // If there's an active map, reload it to reflect any changes
  const activeMapId = useMapStore.getState().activeMapId;
  if (activeMapId) {
    await useMapStore.getState().loadMap(activeMapId);
  }

  return pulled;
}

/** Full sync: compare timestamps, pull newer from remote, push newer from local */
export async function syncMaps(token: string, username: string): Promise<{ pushed: string[]; pulled: string[]; deleted: string[] }> {
  await ensureRepo(token, username);

  const localMaps = await getAllMaps();

  // Read remote index
  const indexFile = await getFile(token, username, 'index.json');
  const remoteIndex: RemoteIndex = indexFile
    ? JSON.parse(indexFile.content)
    : { version: '1.0', maps: [] };

  if (indexFile) {
    shaCache.set('index.json', indexFile.sha);
  }

  const remoteByIds = new Map<string, RemoteMapEntry>();
  for (const entry of remoteIndex.maps) {
    remoteByIds.set(entry.id, entry);
  }

  const localByIds = new Map<string, MindMapMeta>();
  for (const map of localMaps) {
    localByIds.set(map.id, map);
  }

  const pushed: string[] = [];
  const pulled: string[] = [];
  const deleted: string[] = [];

  // Process all local maps
  for (const localMap of localMaps) {
    const remote = remoteByIds.get(localMap.id);

    if (!remote) {
      // Local only — push to remote
      const data = await getMapData(localMap.id);
      if (!data) continue;

      const filePath = `maps/${localMap.id}.json`;
      const content = JSON.stringify(data, null, 2);
      const newSha = await putFile(token, username, filePath, content, undefined, `Sync map: ${localMap.name}`);
      shaCache.set(filePath, newSha);
      pushed.push(localMap.name);
    } else {
      // Exists on both sides — compare timestamps
      const localTime = localMap.updatedAt instanceof Date
        ? localMap.updatedAt.getTime()
        : new Date(localMap.updatedAt).getTime();
      const remoteTime = new Date(remote.updatedAt).getTime();

      if (localTime > remoteTime) {
        // Local is newer — push
        const data = await getMapData(localMap.id);
        if (!data) continue;

        const filePath = `maps/${localMap.id}.json`;
        const content = JSON.stringify(data, null, 2);

        const existing = await getFile(token, username, filePath);
        const sha = existing?.sha;
        if (sha) shaCache.set(filePath, sha);

        const newSha = await putFile(token, username, filePath, content, sha, `Sync map: ${localMap.name}`);
        shaCache.set(filePath, newSha);
        pushed.push(localMap.name);
      } else if (remoteTime > localTime) {
        // Remote is newer — pull
        const filePath = `maps/${localMap.id}.json`;
        const file = await getFile(token, username, filePath);
        if (!file) continue;

        shaCache.set(filePath, file.sha);
        const mapData: MapData = JSON.parse(file.content);
        await saveMapData(mapData);
        await updateMapMeta(localMap.id, {
          name: remote.name,
          type: remote.type,
          updatedAt: new Date(remote.updatedAt),
        });
        pulled.push(remote.name);
      }
      // else: timestamps equal — skip (already synced)
    }
  }

  // Remote-only maps — pull them
  for (const [remoteId, remote] of remoteByIds) {
    if (!localByIds.has(remoteId)) {
      const filePath = `maps/${remoteId}.json`;
      const file = await getFile(token, username, filePath);
      if (!file) continue;

      shaCache.set(filePath, file.sha);
      const mapData: MapData = JSON.parse(file.content);
      await saveMapData(mapData);

      const meta: MindMapMeta = {
        id: remote.id,
        name: remote.name,
        type: remote.type,
        createdAt: new Date(remote.createdAt),
        updatedAt: new Date(remote.updatedAt),
      };
      await dbCreateMap(meta);
      pulled.push(remote.name);
    }
  }

  // Check for maps deleted locally but still on remote — delete from remote
  const remoteFiles = await listFiles(token, username, 'maps');
  for (const file of remoteFiles) {
    const mapId = file.name.replace('.json', '');
    if (!localByIds.has(mapId) && !remoteByIds.has(mapId)) {
      // orphan file — clean it up
      await deleteFile(token, username, `maps/${file.name}`, file.sha);
      deleted.push(file.name);
    }
  }

  // Update the remote index with the final state
  const finalLocalMaps = await getAllMaps();
  const finalIndex: RemoteIndex = {
    version: '1.0',
    maps: finalLocalMaps.map(metaToRemoteEntry),
  };
  const finalIndexContent = JSON.stringify(finalIndex, null, 2);
  const existingIndexSha = shaCache.get('index.json');
  // Re-fetch SHA since it may have changed during sync
  const latestIndex = await getFile(token, username, 'index.json');
  const indexSha = latestIndex?.sha || existingIndexSha;

  const newIndexSha = await putFile(
    token,
    username,
    'index.json',
    finalIndexContent,
    indexSha,
    'Update map index after sync'
  );
  shaCache.set('index.json', newIndexSha);

  // Refresh UI stores
  await useMapStore.getState().init();
  await useTagStore.getState().buildTagIndex();

  // If there's an active map and it was pulled, reload it
  const activeMapId = useMapStore.getState().activeMapId;
  if (activeMapId && pulled.some((name) => {
    const map = finalLocalMaps.find((m) => m.name === name);
    return map?.id === activeMapId;
  })) {
    await useMapStore.getState().loadMap(activeMapId);
  }

  return { pushed, pulled, deleted };
}
