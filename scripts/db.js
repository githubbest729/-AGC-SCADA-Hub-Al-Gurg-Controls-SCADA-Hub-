/* =========================================================
   scripts/db.js
   Vanilla JS IndexedDB Wrapper for AGC SCADA Hub
   ========================================================= */

const DB_NAME = "AGC_SCADA_DB";
const DB_VERSION = 2;

const DB = {
  db: null,

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error("IndexedDB initialization failed", event);
        reject("Database error");
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      // Runs only if DB_VERSION increases or DB doesn't exist
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Define Object Stores (Tables) with 'id' as the primary key
        if (!db.objectStoreNames.contains("projects")) {
          db.createObjectStore("projects", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("requirements")) {
          db.createObjectStore("requirements", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("punchlist")) {
          const punchStore = db.createObjectStore("punchlist", { keyPath: "id" });
          punchStore.createIndex("status", "status", { unique: false });
        }
        if (!db.objectStoreNames.contains("estimates")) {
          db.createObjectStore("estimates", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("kanban")) {
          db.createObjectStore("kanban", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("io_tags")) {
          db.createObjectStore("io_tags", { keyPath: "id" });
        }
      };
    });
  },

  // Generic Method: Get all records from a specific store
  async getAll(storeName) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  // Generic Method: Insert or Update a record
  async put(storeName, data) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  // Generic Method: Delete a record by ID
  async delete(storeName, id) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  // Helper: Seed data if database is empty
  async seedData(jsonData) {
    const existing = await this.getAll("projects");
    if (existing.length > 0) return; // Only seed if empty

    console.log("Seeding initial database...");
    
    // SAFE LOOPS: Checks if the data exists before looping
    if (jsonData.requirements) {
      for (const req of jsonData.requirements) await this.put("requirements", req);
    }
    if (jsonData.punchlist) {
      for (const snag of jsonData.punchlist) await this.put("punchlist", snag);
    }
    if (jsonData.kanban) {
      for (const task of jsonData.kanban) await this.put("kanban", task);
    }
    if (jsonData.projectInfo) {
      await this.put("projects", jsonData.projectInfo);
    }
  }
};
