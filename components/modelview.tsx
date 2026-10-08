"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import styles from "./artifacts_workspace.module.css"

export type ModelFormat = "glb" | "fbx" | "obj"

interface ThreeDModelViewerProps {
  url: string
  format: ModelFormat
  resetSignal: number
  onError: (message: string | null) => void
}

export function ThreeDModelViewer({ url, format, resetSignal, onError }: ThreeDModelViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    setIsLoading(true)
    setLoadError(null)
    let disposed = false
    let animationId = 0
    let model: THREE.Object3D | null = null
    let controls: OrbitControls | null = null
    const scene = new THREE.Scene()
    scene.background = new THREE.Color("#030406")

    const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 1000)
    camera.position.set(0, 0, 4.2)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    renderer.domElement.className = styles.modelCanvas
    renderer.domElement.setAttribute("aria-label", "Interactive 3D model preview")
    mount.appendChild(renderer.domElement)

    scene.add(new THREE.HemisphereLight(0xb8d7ff, 0x17131b, 2.2))
    const keyLight = new THREE.DirectionalLight(0xffffff, 3)
    keyLight.position.set(4, 6, 5)
    scene.add(keyLight)
    const rimLight = new THREE.DirectionalLight(0x48d9ff, 1.7)
    rimLight.position.set(-4, 1, -4)
    scene.add(rimLight)

    controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.075
    controls.enablePan = true
    controls.minDistance = 0.45
    controls.maxDistance = 30
    controlsRef.current = controls

    const resize = () => {
      const width = mount.clientWidth
      const height = mount.clientHeight
      if (!width || !height) return
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }
    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(mount)

    const render = () => {
      animationId = window.requestAnimationFrame(render)
      controls?.update()
      renderer.render(scene, camera)
    }
    render()

    const disposeObject = (object: THREE.Object3D) => {
      object.traverse((node) => {
        const mesh = node as THREE.Mesh
        if (!mesh.isMesh) return
        mesh.geometry?.dispose()
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        materials.forEach((material) => {
          Object.values(material).forEach((value) => {
            if (value instanceof THREE.Texture) value.dispose()
          })
          material.dispose()
        })
      })
    }

    const loadModel = async () => {
      try {
        let loaded: THREE.Object3D
        if (format === "glb") {
          loaded = (await new GLTFLoader().loadAsync(url)).scene
        } else if (format === "fbx") {
          loaded = await new FBXLoader().loadAsync(url)
        } else {
          loaded = await new OBJLoader().loadAsync(url)
        }

        if (disposed) {
          disposeObject(loaded)
          return
        }

        loaded.updateMatrixWorld(true)
        const bounds = new THREE.Box3().setFromObject(loaded)
        const center = bounds.getCenter(new THREE.Vector3())
        const size = bounds.getSize(new THREE.Vector3())
        const largestSide = Math.max(size.x, size.y, size.z, 0.001)
        loaded.position.sub(center)

        const normalized = new THREE.Group()
        normalized.add(loaded)
        normalized.scale.setScalar(2.8 / largestSide)
        scene.add(normalized)
        model = normalized

        controls?.target.set(0, 0, 0)
        controls?.update()
        setIsLoading(false)
      } catch (error) {
        if (disposed) return
        const message = error instanceof Error ? error.message : "Model could not be loaded."
        setLoadError(message)
        setIsLoading(false)
        onError(message)
      }
    }
    void loadModel()

    return () => {
      disposed = true
      window.cancelAnimationFrame(animationId)
      resizeObserver.disconnect()
      controls?.dispose()
      controlsRef.current = null
      if (model) {
        scene.remove(model)
        disposeObject(model)
      }
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [format, onError, url])

  useEffect(() => {
    controlsRef.current?.reset()
  }, [resetSignal])

  return (
    <div className={styles.modelHost} ref={mountRef}>
      {isLoading && !loadError && (
        <div className={styles.viewerStatus} role="status">
          <span className={styles.smallPulse} />
          <span>LOADING MODEL</span>
        </div>
      )}
      {loadError && (
        <div className={styles.viewerError} role="alert">
          <b>MODEL LINK LOST</b>
          <span>{loadError}</span>
        </div>
      )}
    </div>
  )
}
