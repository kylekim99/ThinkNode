import Dexie, { type Table } from 'dexie';
import type { MindMapMeta, MapData } from '../types/mindmap';

class ThinkNodeDB extends Dexie {
  mindmaps!: Table<MindMapMeta>;
  mapData!: Table<MapData>;

  constructor() {
    super('thinknode');

    // Version 1: original schema
    this.version(1).stores({
      mindmaps: 'id, name, createdAt, updatedAt',
      mapData: 'mapId',
    });

    // Version 2: add type field to mindmaps
    this.version(2).stores({
      mindmaps: 'id, name, type, createdAt, updatedAt',
      mapData: 'mapId',
    }).upgrade((tx) => {
      return tx.table('mindmaps').toCollection().modify((map) => {
        if (!map.type) {
          map.type = 'mindmap';
        }
      });
    });
  }
}

export const db = new ThinkNodeDB();

export async function getAllMaps(): Promise<MindMapMeta[]> {
  return db.mindmaps.orderBy('updatedAt').reverse().toArray();
}

export async function createMap(meta: MindMapMeta): Promise<void> {
  await db.mindmaps.add(meta);
}

export async function updateMapMeta(id: string, changes: Partial<MindMapMeta>): Promise<void> {
  await db.mindmaps.update(id, changes);
}

export async function deleteMapFromDB(id: string): Promise<void> {
  await db.transaction('rw', db.mindmaps, db.mapData, async () => {
    await db.mindmaps.delete(id);
    await db.mapData.delete(id);
  });
}

export async function getMapData(mapId: string): Promise<MapData | undefined> {
  return db.mapData.get(mapId);
}

export async function saveMapData(data: MapData): Promise<void> {
  await db.mapData.put(data);
}
