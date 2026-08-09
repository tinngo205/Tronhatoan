# Offline-First PWA Synchronization

CoBuy is engineered as an **Offline-First Progressive Web Application (PWA)**. Users can record grocery expenditures, toggle attendance check-ins, and delete entries even when disconnected from the internet. Changes are queued locally and automatically synchronized once connectivity is restored.

---

## 1. Local Database & Queue (`src/lib/db.ts`)

CoBuy uses **Dexie.js** as a lightweight wrapper over the browser's native **IndexedDB** engine to maintain two local stores:
1. **`offlineMutations`**: The mutation write queue. Stores details about actions the user performed offline (create expense, edit expense, check-in attendance, delete expense) along with a unique `client_mutation_id`.
2. **`cache`**: A key-value caching store. Holds static data reads (like members list, dashboard summary) to load pages instantly on boot before fetching fresh database data.

---

## 2. Queue Synchronization Hook (`src/hooks/useOfflineSync.ts`)

The synchronization hook handles network status monitoring and queue execution:

### A. Operations Flow
1. **Queueing writes**: If the user performs a write action while offline, the app inserts a record into the IndexedDB `offlineMutations` table and optimistically applies the changes locally.
2. **Reconnection triggers**: The hook listens to window events (`online`, `offline`) and navigator status (`navigator.onLine`).
3. **Queue execution**: Upon detecting reconnection, the hook pulls the mutations queue in strict chronological order and submits them sequentially to Next.js Server Actions.
4. **Clean up**: When a server action succeeds, the mutation is deleted from the queue. If it fails due to a validation error (like a locked settlement period), the transaction is flagged or discarded, preventing queue blocking.

---

## 3. Service Worker & Manifest Configuration

To allow installation on iOS/Android devices and enable caching:
- **`public/manifest.json`**: Configures app branding (CoBuy), theme colors, stand-alone display modes, start URLs, and reference logo assets (192px, 512px).
- **`public/sw.js`**:
  - Implements standard Cache-First behavior for static UI assets (compiled JS, CSS, fonts, SVG icons).
  - Implements Network-First behavior for API endpoints and Server Actions to ensure real-time accuracy when connected.
- **`src/components/common/PWASegister.tsx`**: Client Component placed in the root layout to dynamically register `/sw.js` upon mounting.
