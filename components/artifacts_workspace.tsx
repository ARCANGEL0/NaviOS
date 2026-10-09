"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useRef, useState } from "react"
import { Download, LoaderCircle, Paperclip, PanelRightClose, PanelRightOpen, RotateCcw, Send, Trash2, X } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import {
  deleteCached3DModel,
  download3DModel,
  getCached3DModel,
  requestPersistent3DModelStorage,
  saveCached3DModel,
} from "@/lib/artif_cache"
import type { ModelFormat } from "@/components/modelview"
import styles from "./artifacts_workspace.module.css"

const ThreeDModelViewer = dynamic(
  () => import("@/components/modelview").then((module) => module.ThreeDModelViewer),
  { ssr: false }
)

const API_BASE_URL = "/api"
const ARTIFACTS_KEY = "NAVI_3D_ARTIFACTS_7E91C4A2_V1"
const ACTIVE_ARTIFACT_KEY = "NAVI_3D_ACTIVE_39B6D0F5_V1"
const PENDING_GENERATION_KEY = "NAVI_3D_PENDING_GENERATION_V1"
const GENERATION_TIMEOUT_MS = 45 * 60 * 1000
const MAX_IMAGE_BYTES = 32 * 1024 * 1024
const SUPPORTED_FORMATS: ModelFormat[] = ["glb", "fbx", "obj"]
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"])
const IMAGE_MIMES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
}

interface Artifact {
  id: string
  name: string
  prompt: string
  format: ModelFormat
  url: string
  createdAt: number
}

type JsonObject = Record<string, unknown>

interface GenerationMetadata {
  artifactId: string
  format: ModelFormat
  prompt: string
  imageName: string
}

interface PendingGeneration extends GenerationMetadata {
  taskId: string
  startedAt: number
  result?: JsonObject
}

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const clearPendingGeneration = () => {
  try {
    window.localStorage.removeItem(PENDING_GENERATION_KEY)
  } catch {
  }
}

const isPendingGeneration = (value: unknown): value is PendingGeneration => {
  if (!isJsonObject(value)) return false
  return (
    typeof value.taskId === "string" &&
    typeof value.artifactId === "string" &&
    isModelFormat(value.format) &&
    typeof value.prompt === "string" &&
    typeof value.imageName === "string" &&
    typeof value.startedAt === "number" &&
    (value.result === undefined || isJsonObject(value.result))
  )
}

const isModelFormat = (value: unknown): value is ModelFormat =>
  typeof value === "string" && SUPPORTED_FORMATS.includes(value as ModelFormat)

const isArtifact = (value: unknown): value is Artifact => {
  if (!isJsonObject(value)) return false
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.prompt === "string" &&
    isModelFormat(value.format) &&
    typeof value.url === "string" &&
    typeof value.createdAt === "number"
  )
}

const isLegacyModelUrl = (value: string): boolean => {
  try {
    const host = new URL(value).hostname
    return host === "litter.catbox.moe" || host === "files.catbox.moe"
  } catch {
    return false
  }
}

const imageMime = (file: File): string => {
  if (IMAGE_TYPES.has(file.type)) return file.type
  const extension = file.name.split(".").pop()?.toLowerCase() ?? ""
  return IMAGE_MIMES[extension] ?? ""
}

const isSupportedImage = (file: File): boolean => Boolean(imageMime(file))

const readImageDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Image could not be read."))
    reader.onabort = () => reject(new Error("Image read was interrupted."))
    reader.onload = () => {
      const raw = typeof reader.result === "string" ? reader.result : ""
      const encoded = raw.split(",")[1]
      const mime = imageMime(file)
      if (!encoded || !mime) {
        reject(new Error("Image data is invalid."))
        return
      }
      resolve("data:" + mime + ";base64," + encoded)
    }
    reader.readAsDataURL(file)
  })

const wait = (duration: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Request stopped.", "AbortError"))
      return
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", abort)
      resolve()
    }, duration)
    const abort = () => {
      window.clearTimeout(timer)
      signal.removeEventListener("abort", abort)
      reject(new DOMException("Request stopped.", "AbortError"))
    }
    signal.addEventListener("abort", abort, { once: true })
  })

const readResponse = async (response: Response): Promise<JsonObject> => {
  const text = await response.text()
  let body: unknown
  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    throw new Error("The 3D endpoint returned an unreadable response.")
  }
  if (!isJsonObject(body)) {
    throw new Error("The 3D endpoint returned an invalid response.")
  }
  if (!response.ok) {
    const detail = typeof body.error === "string" ? body.error : "HTTP " + response.status
    throw new Error(detail)
  }
  return body
}

const errorMessage = (value: unknown): string =>
  value instanceof Error ? value.message : "The 3D request could not be completed."

export function ThreeDWorkspace() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const artifactsRef = useRef<Artifact[]>([])
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null)
  const [modelSource, setModelSource] = useState<{ artifactId: string; url: string } | null>(null)
  const [loadingArtifactId, setLoadingArtifactId] = useState<string | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [format, setFormat] = useState<ModelFormat>("glb")
  const [prompt, setPrompt] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [composerNotice, setComposerNotice] = useState<string | null>(null)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [viewerError, setViewerError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [pendingSince, setPendingSince] = useState<number | null>(null)
  const [progress, setProgress] = useState(0)
  const [resetSignal, setResetSignal] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const dragDepthRef = useRef(0)
  const activeArtifact = artifacts.find((artifact) => artifact.id === activeArtifactId) ?? null
  const activeModelUrl = activeArtifact && modelSource?.artifactId === activeArtifact.id
    ? modelSource.url
    : null

  useEffect(() => {
    setIsSidebarOpen(window.matchMedia("(min-width: 701px)").matches)
  }, [])

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(ARTIFACTS_KEY)
      const parsed: unknown = stored ? JSON.parse(stored) : []
      const saved = Array.isArray(parsed) ? parsed.filter(isArtifact) : []
      artifactsRef.current = saved
      setArtifacts(saved)

      const storedActiveId = window.localStorage.getItem(ACTIVE_ARTIFACT_KEY)
      const nextActive = saved.some((artifact) => artifact.id === storedActiveId)
        ? storedActiveId
        : saved[0]?.id ?? null
      setActiveArtifactId(nextActive)
    } catch {
      artifactsRef.current = []
      setArtifacts([])
      setActiveArtifactId(null)
    }
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    if (!isHydrated) return
    try {
      window.localStorage.setItem(ARTIFACTS_KEY, JSON.stringify(artifacts))
    } catch {
      setComposerNotice("LOCAL ARTIFACT INDEX COULD NOT BE SAVED.")
    }
  }, [artifacts, isHydrated])

  useEffect(() => {
    if (!isHydrated) return
    if (activeArtifactId) {
      window.localStorage.setItem(ACTIVE_ARTIFACT_KEY, activeArtifactId)
    } else {
      window.localStorage.removeItem(ACTIVE_ARTIFACT_KEY)
    }
  }, [activeArtifactId, isHydrated])

  useEffect(() => {
    artifactsRef.current = artifacts
  }, [artifacts])

  useEffect(() => {
    if (!isHydrated || !activeArtifact) {
      setModelSource(null)
      setLoadingArtifactId(null)
      return
    }

    let cancelled = false
    let objectUrl: string | null = null
    const artifact = activeArtifact
    setModelSource(null)
    setLoadingArtifactId(artifact.id)
    setViewerError(null)

    void (async () => {
      try {
        let blob = await getCached3DModel(artifact.id)
        if (!blob) {
          if (!artifact.url) {
            throw new Error("MODEL FILE IS NOT AVAILABLE IN THIS BROWSER'S STORAGE.")
          }
          try {
            blob = await download3DModel(artifact.url, artifact.format)
          } catch (directError) {
            if (!isLegacyModelUrl(artifact.url)) throw directError
            const response = await fetch(API_BASE_URL + "/assetSync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url: artifact.url, format: artifact.format }),
              cache: "no-store",
            })
            const body = await readResponse(response)
            if (body.status !== true || typeof body.file !== "string") throw directError
            blob = await download3DModel(body.file, artifact.format)
          }
          await saveCached3DModel(artifact.id, artifact.format, blob)
          void requestPersistent3DModelStorage()
        }

        if (artifact.url) {
          const nextArtifacts = artifactsRef.current.map((item) =>
            item.id === artifact.id ? { ...item, url: "" } : item
          )
          artifactsRef.current = nextArtifacts
          setArtifacts(nextArtifacts)
          try {
            window.localStorage.setItem(ARTIFACTS_KEY, JSON.stringify(nextArtifacts))
          } catch {
            setComposerNotice("MODEL IS LOCAL, BUT ITS ARTIFACT INDEX COULD NOT BE UPDATED.")
          }
        }

        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setModelSource({ artifactId: artifact.id, url: objectUrl })
        setLoadingArtifactId(null)
      } catch (error) {
        if (cancelled) return
        setViewerError(errorMessage(error))
        setLoadingArtifactId(null)
      }
    })()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [activeArtifact, isHydrated])

  useEffect(() => {
    if (pendingSince === null) {
      setProgress(0)
      return
    }
    const updateProgress = () => {
      const elapsed = Date.now() - pendingSince
      const next = Math.min(92, Math.round(14 + 78 * (1 - Math.exp(-elapsed / 65000))))
      setProgress(next)
    }
    updateProgress()
    const timer = window.setInterval(updateProgress, 300)
    return () => window.clearInterval(timer)
  }, [pendingSince])

  const selectArtifact = useCallback((artifact: Artifact) => {
    setActiveArtifactId(artifact.id)
    setGenerationError(null)
    setViewerError(null)
    try {
      window.localStorage.setItem(ACTIVE_ARTIFACT_KEY, artifact.id)
    } catch {
      setComposerNotice("ACTIVE ARTIFACT COULD NOT BE SAVED.")
    }
  }, [])

  const removeArtifact = useCallback((artifactId: string) => {
    const next = artifactsRef.current.filter((artifact) => artifact.id !== artifactId)
    artifactsRef.current = next
    setArtifacts(next)
    void deleteCached3DModel(artifactId).catch(() => {
      setComposerNotice("ARTIFACT REMOVED, BUT ITS LOCAL FILE COULD NOT BE CLEARED.")
    })
    try {
      window.localStorage.setItem(ARTIFACTS_KEY, JSON.stringify(next))
    } catch {
      setComposerNotice("LOCAL ARTIFACT INDEX COULD NOT BE SAVED.")
    }
    if (activeArtifactId === artifactId) {
      const nextActiveId = next[0]?.id ?? null
      setActiveArtifactId(nextActiveId)
      setViewerError(null)
      if (nextActiveId) {
        window.localStorage.setItem(ACTIVE_ARTIFACT_KEY, nextActiveId)
      } else {
        window.localStorage.removeItem(ACTIVE_ARTIFACT_KEY)
      }
    }
  }, [activeArtifactId])

  const onImageChosen = useCallback((file?: File) => {
    if (!file) return
    if (!isSupportedImage(file)) {
      setComposerNotice("IMAGE INPUT ONLY.")
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setComposerNotice("IMAGE EXCEEDS THE 32 MB LIMIT.")
      return
    }
    setComposerNotice(null)
    setImageFile(file)
  }, [])

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onImageChosen(event.currentTarget.files?.[0])
    event.currentTarget.value = ""
  }

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    const files = Array.from(event.dataTransfer.files ?? [])
    if (files.length === 0) return
    event.preventDefault()
    dragDepthRef.current = 0
    setIsDragging(false)
    if (files.length > 1) {
      setComposerNotice("ONE IMAGE MAXIMUM.")
      return
    }
    onImageChosen(files[0])
  }

  const pollTask = useCallback(async (
    taskId: string,
    startedAt: number,
    signal: AbortSignal
  ): Promise<JsonObject> => {
    let failures = 0
    while (Date.now() - startedAt < GENERATION_TIMEOUT_MS) {
      const backoff = failures === 0 ? 2200 : Math.min(15000, 1500 * 2 ** Math.min(failures - 1, 4))
      await wait(backoff, signal)
      const remainingMs = GENERATION_TIMEOUT_MS - (Date.now() - startedAt)
      if (remainingMs <= 0) break

      const pollController = new AbortController()
      const timeout = window.setTimeout(() => pollController.abort(), Math.min(20000, remainingMs))
      const abortPoll = () => pollController.abort()
      signal.addEventListener("abort", abortPoll, { once: true })

      let response: Response
      try {
        response = await fetch(API_BASE_URL + "/create3D", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId }),
          cache: "no-store",
          signal: pollController.signal,
        })
      } catch (error) {
        if (signal.aborted) throw error
        failures += 1
        continue
      } finally {
        window.clearTimeout(timeout)
        signal.removeEventListener("abort", abortPoll)
      }

      if (response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500) {
        failures += 1
        continue
      }

      if (response.status === 404 || response.status === 410) {
        clearPendingGeneration()
      }
      if (!response.ok) clearPendingGeneration()

      let task: JsonObject
      try {
        task = await readResponse(response)
      } catch (error) {
        if (!response.ok) throw error
        failures += 1
        continue
      }

      failures = 0
      if (task.status === "processing") continue
      if (task.status === "completed" && isJsonObject(task.response)) return task.response
      if (task.status === "error") {
        clearPendingGeneration()
        throw new Error(typeof task.message === "string" ? task.message : "3D generation failed.")
      }
      throw new Error("The 3D task returned an unknown state.")
    }

    clearPendingGeneration()
    throw new Error("3D generation exceeded the 45 minute wait window.")
  }, [])

  const completeGeneration = useCallback((result: JsonObject, metadata: GenerationMetadata) => {
    if (result.status !== true) {
      throw new Error(typeof result.error === "string" ? result.error : "3D generation failed.")
    }
    if (typeof result.file !== "string" || !/^https?:\/\//i.test(result.file)) {
      throw new Error("The endpoint did not return a usable model URL.")
    }

    const resultFormat = isModelFormat(result.filetype) ? result.filetype : metadata.format
    const baseName = metadata.prompt || metadata.imageName.replace(/\.[^.]+$/, "") || "Generated model"
    const artifact: Artifact = {
      id: metadata.artifactId,
      name: baseName.slice(0, 58),
      prompt: metadata.prompt || (metadata.imageName ? "Image to 3D: " + metadata.imageName : ""),
      format: resultFormat,
      url: result.file,
      createdAt: Date.now(),
    }
    const nextArtifacts = [artifact, ...artifactsRef.current.filter((item) => item.id !== artifact.id)].slice(0, 100)
    const retainedIds = new Set(nextArtifacts.map((item) => item.id))
    for (const oldArtifact of artifactsRef.current) {
      if (!retainedIds.has(oldArtifact.id)) {
        void deleteCached3DModel(oldArtifact.id).catch(() => undefined)
      }
    }

    artifactsRef.current = nextArtifacts
    setArtifacts(nextArtifacts)
    setActiveArtifactId(artifact.id)
    setViewerError(null)
    setPrompt("")
    setImageFile(null)

    try {
      window.localStorage.setItem(ARTIFACTS_KEY, JSON.stringify(nextArtifacts))
      window.localStorage.setItem(ACTIVE_ARTIFACT_KEY, artifact.id)
      window.localStorage.removeItem(PENDING_GENERATION_KEY)
    } catch {
      setComposerNotice("MODEL READY, BUT THE LOCAL ARTIFACT INDEX COULD NOT BE SAVED.")
    }
    window.dispatchEvent(new Event("navi:3d-artifact-ready"))
  }, [])

  const resumedTaskRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isHydrated) return

    let pending: PendingGeneration | null = null
    try {
      const raw = window.localStorage.getItem(PENDING_GENERATION_KEY)
      const parsed: unknown = raw ? JSON.parse(raw) : null
      if (isPendingGeneration(parsed)) pending = parsed
      else if (raw) window.localStorage.removeItem(PENDING_GENERATION_KEY)
    } catch {
      window.localStorage.removeItem(PENDING_GENERATION_KEY)
    }
    if (!pending) return

    if (!pending.result && Date.now() - pending.startedAt >= GENERATION_TIMEOUT_MS) {
      window.localStorage.removeItem(PENDING_GENERATION_KEY)
      setGenerationError("The saved 3D task exceeded the 45 minute wait window.")
      return
    }
    if (resumedTaskRef.current === pending.taskId) return

    const task = pending
    const controller = new AbortController()
    let active = true
    resumedTaskRef.current = task.taskId
    abortRef.current = controller
    setGenerationError(null)
    setIsPending(true)
    setPendingSince(task.startedAt)

    void (async () => {
      try {
        const result = task.result ?? await pollTask(task.taskId, task.startedAt, controller.signal)
        if (!active) return
        try {
          window.localStorage.setItem(PENDING_GENERATION_KEY, JSON.stringify({ ...task, result }))
        } catch {
          setComposerNotice("MODEL RECEIVED, BUT TASK RECOVERY COULD NOT BE SAVED.")
        }
        completeGeneration(result, task)
      } catch (error) {
        if (active) setGenerationError(errorMessage(error))
      } finally {
        if (active) {
          if (abortRef.current === controller) abortRef.current = null
          resumedTaskRef.current = null
          setIsPending(false)
          setPendingSince(null)
        }
      }
    })()

    return () => {
      active = false
      controller.abort()
      if (resumedTaskRef.current === task.taskId) resumedTaskRef.current = null
      if (abortRef.current === controller) abortRef.current = null
    }
  }, [completeGeneration, isHydrated, pollTask])

  const generate = async () => {
    const cleanPrompt = prompt.trim()
    if (!isHydrated || isPending || (!cleanPrompt && !imageFile)) return

    const controller = new AbortController()
    abortRef.current = controller
    setGenerationError(null)
    setViewerError(null)
    setComposerNotice(null)
    setIsPending(true)
    setPendingSince(Date.now())

    try {
      const requestBody: JsonObject = { filetype: format, async: true }
      if (imageFile) {
        requestBody.image_input = await readImageDataUrl(imageFile)
      } else {
        requestBody.text_input = cleanPrompt
      }

      const initialResponse = await fetch(API_BASE_URL + "/create3D", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        cache: "no-store",
        signal: controller.signal,
      })
      const initial = await readResponse(initialResponse)
      let result = initial
      const metadata: GenerationMetadata = {
        artifactId: window.crypto.randomUUID(),
        format,
        prompt: cleanPrompt,
        imageName: imageFile?.name ?? "",
      }

      if (typeof initial.taskId === "string") {
        const pending: PendingGeneration = {
          ...metadata,
          taskId: initial.taskId,
          startedAt: Date.now(),
        }
        try {
          window.localStorage.setItem(PENDING_GENERATION_KEY, JSON.stringify(pending))
        } catch {
          setComposerNotice("TASK ACCEPTED, BUT RELOAD RECOVERY COULD NOT BE SAVED.")
        }
        setPendingSince(pending.startedAt)
        result = await pollTask(initial.taskId, pending.startedAt, controller.signal)
        try {
          window.localStorage.setItem(PENDING_GENERATION_KEY, JSON.stringify({ ...pending, result }))
        } catch {
          setComposerNotice("MODEL RECEIVED, BUT TASK RECOVERY COULD NOT BE SAVED.")
        }
      }

      completeGeneration(result, metadata)
    } catch (error) {
      setGenerationError(errorMessage(error))
    } finally {
      abortRef.current = null
      setIsPending(false)
      setPendingSince(null)
    }
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void generate()
  }

  const onTextKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      formRef.current?.requestSubmit()
    }
  }

  const onDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return
    event.preventDefault()
    dragDepthRef.current += 1
    setIsDragging(true)
  }

  const onDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return
    event.preventDefault()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) setIsDragging(false)
  }

  const handleViewerError = useCallback((message: string | null) => {
    setViewerError(message)
  }, [])

  const title = activeArtifact?.name ?? "3D DISPLAY"
  const showGenerationError = Boolean(generationError)
  const showViewerError = Boolean(activeArtifact && viewerError)
  const showEmpty = !isPending && !showGenerationError && !showViewerError && !activeArtifact
  const showModelLoading = Boolean(activeArtifact && loadingArtifactId === activeArtifact.id)
  const canSend = isHydrated && !isPending && (prompt.trim().length > 0 || Boolean(imageFile))

  return (
    <div
      className={styles.root}
      onDragEnter={onDragEnter}
      onDragOver={(event) => {
        if (Array.from(event.dataTransfer.types).includes("Files")) event.preventDefault()
      }}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className={styles.workarea}>
        <section className={styles.stage} aria-label="3D model display">
          <header className={styles.screenHeader}>
            <div className={styles.screenIdentity}>
              <span className={styles.signalDot} aria-hidden />
              <span className={styles.screenTitle} title={title}>{title}</span>
              {activeArtifact && <span className={styles.screenFormat}>{activeArtifact.format.toUpperCase()}</span>}
            </div>
            <div className={styles.screenActions}>
              {activeArtifact && (
                <>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => setResetSignal((value) => value + 1)}
                    title="Reset model view"
                    aria-label="Reset model view"
                  >
                    <RotateCcw size={14} />
                  </button>
                  {activeModelUrl && (
                    <a
                      className={styles.iconButton}
                      href={activeModelUrl}
                      download={activeArtifact.name + "." + activeArtifact.format}
                      title="Download model saved in this browser"
                      aria-label="Download model saved in this browser"
                    >
                      <Download size={14} />
                    </a>
                  )}
                </>
              )}
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setIsSidebarOpen((open) => !open)}
                title={isSidebarOpen ? "Collapse artifacts" : "Expand artifacts"}
                aria-label={isSidebarOpen ? "Collapse artifacts" : "Expand artifacts"}
                aria-expanded={isSidebarOpen}
              >
                {isSidebarOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
              </button>
            </div>
          </header>

          {isPending ? (
            <div className={styles.loadingStage} role="status" aria-live="polite">
              <div className={styles.loadingContent}>
                <span className={styles.loadingTitle}>SYNTHESIZING MESH</span>
                <div className={styles.progressTrack} aria-label="Generation in progress">
                  <div className={styles.progressValue} style={{ width: progress + "%" }} />
                </div>
                <span className={styles.loadingDetail}>
                  {imageFile ? "IMAGE INPUT // GEOMETRY EXTRACTION" : "TEXT INPUT // SCENE CONSTRUCTION"}
                  {"  "}{progress}%
                </span>
              </div>
            </div>
          ) : showGenerationError || showViewerError ? (
            <div className={styles.errorStage} role="alert">
              <div className={styles.errorContent}>
                <span className={styles.errorTitle}>
                  {showViewerError ? "LOCAL MODEL UNAVAILABLE" : "NAVI // GENERATION INTERRUPTED"}
                </span>
                <span className={styles.errorDetail}>
                  {showViewerError ? viewerError : generationError}
                </span>
              </div>
            </div>
          ) : showModelLoading ? (
            <div className={styles.loadingStage} role="status" aria-live="polite">
              <div className={styles.loadingContent}>
                <span className={styles.loadingTitle}>LOADING LOCAL MODEL</span>
                <span className={styles.loadingDetail}>READING FROM BROWSER STORAGE</span>
              </div>
            </div>
          ) : showEmpty ? (
            <div className={styles.blankStage}>
              <div className={styles.blankMark}>
                <span className={styles.blankCross} aria-hidden />
                <span>NO MODEL LOADED</span>
              </div>
            </div>
          ) : activeArtifact && activeModelUrl ? (
            <div className={styles.viewport}>
              <ThreeDModelViewer
                key={activeArtifact.id}
                url={activeModelUrl}
                format={activeArtifact.format}
                resetSignal={resetSignal}
                onError={handleViewerError}
              />
            </div>
          ) : null}

          {isDragging && (
            <div className={styles.errorStage} aria-hidden>
              <div className={styles.loadingContent}>
                <span className={styles.loadingTitle}>IMAGE INPUT READY</span>
              </div>
            </div>
          )}
        </section>

        <aside className={styles.artifactsPanel} data-open={isSidebarOpen}>
          <div className={styles.artifactsInner}>
            <div className={styles.artifactsHeader}>
              <span>ARTIFACTS</span>
              <span className={styles.artifactCount}>{artifacts.length.toString().padStart(2, "0")}</span>
            </div>
            <div className={styles.artifactList}>
              {artifacts.length === 0 ? (
                <div className={styles.artifactEmpty}>NO SAVED MODELS</div>
              ) : (
                artifacts.map((artifact, index) => (
                  <div className={styles.artifactRow} key={artifact.id}>
                    <button
                      type="button"
                      className={styles.artifactItem}
                      data-active={artifact.id === activeArtifactId}
                      onClick={() => selectArtifact(artifact)}
                      title={artifact.prompt || artifact.name}
                    >
                      <span className={styles.artifactBadge}>{String(index + 1).padStart(2, "0")}</span>
                      <span className={styles.artifactMeta}>
                        <span className={styles.artifactName}>{artifact.name}</span>
                        <span className={styles.artifactDate}>
                          {artifact.format.toUpperCase()} · {new Date(artifact.createdAt).toLocaleDateString()}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={styles.artifactRemove}
                      onClick={() => removeArtifact(artifact.id)}
                      title="Remove artifact"
                      aria-label={"Remove " + artifact.name}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>

      <form className={styles.composer} onSubmit={handleSubmit} ref={formRef}>
        <div className={styles.composerInner}>
          <div className={styles.textareaWrap}>
            <Textarea
              frame="nero"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={onTextKeyDown}
              disabled={isPending}
              placeholder="Type your message here..."
              aria-label="3D generation prompt"
              className={"chatboxshell relative z-[2] min-h-[92px] resize-none bg-transparent " + styles.textarea}
            />
            <label className={styles.formatControl}>
              <span className={styles.formatLabel}>FILETYPE:</span>
              <select
                className={styles.formatSelect}
                value={format}
                onChange={(event) => setFormat(event.target.value as ModelFormat)}
                disabled={isPending}
                aria-label="3D export filetype"
              >
                {SUPPORTED_FORMATS.map((supportedFormat) => (
                  <option value={supportedFormat} key={supportedFormat}>
                    {supportedFormat.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.composerActions}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={onFileChange}
                disabled={isPending || Boolean(imageFile)}
                className="hidden"
              />
              <button
                type="button"
                className={styles.composerButton}
                onClick={() => fileInputRef.current?.click()}
                disabled={isPending || Boolean(imageFile)}
                title={imageFile ? "One image maximum" : "Attach one image"}
                aria-label={imageFile ? "One image maximum" : "Attach one image"}
              >
                <Paperclip size={15} />
              </button>
              <button
                type="submit"
                className={styles.composerButton}
                disabled={!canSend}
                title={isPending ? "Generation in progress" : "Generate 3D model"}
                aria-label={isPending ? "Generation in progress" : "Generate 3D model"}
              >
                {isPending ? <LoaderCircle className="animate-spin" size={15} /> : <Send size={15} />}
              </button>
            </div>
          </div>

          {imageFile && (
            <div className={styles.imageChip}>
              <span className={styles.imageName} title={imageFile.name}>{imageFile.name}</span>
              <span>{(imageFile.size / (1024 * 1024)).toFixed(1)} MB</span>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setImageFile(null)}
                disabled={isPending}
                title="Remove image"
                aria-label="Remove attached image"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
          {composerNotice && <div className={styles.notice} role="status">{composerNotice}</div>}
        </div>
      </form>
    </div>
  )
}
