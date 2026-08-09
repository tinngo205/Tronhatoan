import Dexie, { type Table } from "dexie";

export interface OfflineMutation {
  id: string; // client_mutation_id (UUID)
  action: "CREATE_EXPENSE" | "VOID_EXPENSE" | "UPDATE_EXPENSE" | "SAVE_ATTENDANCE";
  payload: any;
  createdAt: number;
}

export interface OfflineCache {
  key: string; // e.g. "expenses-[groupId]", "members-[groupId]"
  data: any;
  updatedAt: number;
}

class CoBuyOfflineDatabase extends Dexie {
  mutations!: Table<OfflineMutation>;
  cache!: Table<OfflineCache>;

  constructor() {
    super("CoBuyOfflineDB");
    this.version(1).stores({
      mutations: "id, action, createdAt",
      cache: "key, updatedAt",
    });
  }
}

export const db = new CoBuyOfflineDatabase();
