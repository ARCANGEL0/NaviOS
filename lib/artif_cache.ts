export const MAX_3D_MODEL_BYTES = 250 * 1024 * 1024

type ModelFormat = "glb" | "fbx" | "obj"

interface CachedModel {
  id: string
  blob: Blob
  format: ModelFormat
  size: number
  savedAt: number
  lastAccessed: number
}

const DATABASE_NAME = "navi-3d-models"
const DATABASE_VERSION = 1
const STORE_NAME = "models"

let databasePromise: Promise<IDBDatabase> | null = null

const openDatabase = (): Promise<IDBDatabase> => {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("This browser does not support local model storage."))
  }

  if (!databasePromise) {
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: "id" })
        }
      }

      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close()
        resolve(request.result)
      }
      request.onerror = () => reject(request.error ?? new Error("Local model storage could not be opened."))
    })
    databasePromise = opening.catch((error: unknown) => {
      databasePromise = null
      throw error
    })
  }

  return databasePromise!
}

export const getCached3DModel = async (id: string): Promise<Blob | null> => {
  const database = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(id)
    let blob: Blob | null = null

    request.onsuccess = () => {
      const entry = request.result as CachedModel | undefined
      if (!(entry?.blob instanceof Blob)) return
      blob = entry.blob
      store.put({ ...entry, lastAccessed: Date.now() })
    }

    transaction.oncomplete = () => resolve(blob)
    transaction.onerror = () => reject(transaction.error ?? new Error("Local model could not be read."))
    transaction.onabort = () => reject(transaction.error ?? new Error("Local model read was interrupted."))
  })
}

export const saveCached3DModel = async (id: string, format: ModelFormat, blob: Blob): Promise<void> => {
  if (blob.size === 0) throw new Error("The downloaded model file is empty.")
  if (blob.size > MAX_3D_MODEL_BYTES) {
    throw new Error("The model exceeds the 250 MB local storage limit.")
  }

  const database = await openDatabase()
  const now = Date.now()
  const entry: CachedModel = {
    id,
    blob,
    format,
    size: blob.size,
    savedAt: now,
    lastAccessed: now,
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite")
    transaction.objectStore(STORE_NAME).put(entry)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error("Model could not be saved in browser storage."))
    transaction.onabort = () => reject(transaction.error ?? new Error("Saving the model was interrupted."))
  })
}

export const deleteCached3DModel = async (id: string): Promise<void> => {
  const database = await openDatabase()

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite")
    transaction.objectStore(STORE_NAME).delete(id)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error("Local model could not be removed."))
    transaction.onabort = () => reject(transaction.error ?? new Error("Removing the model was interrupted."))
  })
}

export const requestPersistent3DModelStorage = async (): Promise<boolean> => {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false
  try {
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export const download3DModel = async (
  url: string,
  format: ModelFormat,
  signal?: AbortSignal
): Promise<Blob> => {
  const response = await fetch(url, {
    cache: "no-store",
    ...(signal ? { signal } : {}),
  })
  if (!response.ok) throw new Error("Model download failed (HTTP " + response.status + ").")

  const contentLength = Number(response.headers.get("content-length"))
  if (Number.isFinite(contentLength) && contentLength > MAX_3D_MODEL_BYTES) {
    throw new Error("The model exceeds the 250 MB local storage limit.")
  }

  const chunks: BlobPart[] = []
  let size = 0
  if (response.body) {
    const reader = response.body.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (!value?.byteLength) continue
        size += value.byteLength
        if (size > MAX_3D_MODEL_BYTES) {
          await reader.cancel()
          throw new Error("The model exceeds the 250 MB local storage limit.")
        }
        const chunk = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer
        chunks.push(chunk)
      }
    } catch (error) {
      await reader.cancel().catch(() => undefined)
      throw error
    }
  } else {
    const buffer = await response.arrayBuffer()
    size = buffer.byteLength
    if (size > MAX_3D_MODEL_BYTES) {
      throw new Error("The model exceeds the 250 MB local storage limit.")
    }
    chunks.push(buffer)
  }

  if (size === 0) throw new Error("The downloaded model file is empty.")
  const contentType = format === "glb"
    ? "model/gltf-binary"
    : format === "fbx"
      ? "application/octet-stream"
      : "text/plain"
  return new Blob(chunks, { type: response.headers.get("content-type") || contentType })
}
