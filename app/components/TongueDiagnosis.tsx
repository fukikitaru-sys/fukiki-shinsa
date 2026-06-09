'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

type Phase = 'idle' | 'guide' | 'camera' | 'preview' | 'analyzing' | 'result' | 'error'

interface Props {
  onComplete?: (result: Record<string, unknown>, imageUrl: string) => void
  onCaptureForBackground?: (imgFile: File, previewUrl: string) => void  // バックグラウンド分析用
  onCancel: () => void
}

async function resizeImage(file: File, maxSize = 1200): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let { width, height } = img
      if (width > maxSize || height > maxSize) {
        if (width > height) { height = Math.round(height * maxSize / width); width = maxSize }
        else { width = Math.round(width * maxSize / height); height = maxSize }
      }
      canvas.width = width; canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => {
        resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file)
        URL.revokeObjectURL(url)
      }, 'image/jpeg', 0.85)
    }
    img.src = url
  })
}

export default function TongueDiagnosis({ onComplete, onCaptureForBackground, onCancel }: Props) {
  const [phase, setPhase] = useState<Phase>('guide')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState('')
  const [cameraReady, setCameraReady] = useState(false)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraReady(false)
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  const startCamera = useCallback(async (facing: 'environment' | 'user' = 'environment') => {
    setPhase('camera'); setCameraReady(false); stopCamera()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } }
      })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() }
    } catch {
      stopCamera(); fileInputRef.current?.click(); setPhase('guide')
    }
  }, [stopCamera])

  const handleShutter = useCallback(() => {
    const video = videoRef.current; const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480
    canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(async blob => {
      if (!blob) return
      const file = new File([blob], `tongue_${Date.now()}.jpg`, { type: 'image/jpeg' })
      const resized = await resizeImage(file)
      setImageFile(resized); setPreviewUrl(URL.createObjectURL(resized))
      stopCamera(); setPhase('preview')
    }, 'image/jpeg', 0.9)
  }, [stopCamera])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) { setPhase('guide'); return }
    const resized = await resizeImage(file)
    setImageFile(resized); setPreviewUrl(URL.createObjectURL(resized)); setPhase('preview')
    e.target.value = ''
  }, [])

  const handleAnalyze = useCallback(async () => {
    if (!imageFile) return
    setPhase('analyzing')
    try {
      const formData = new FormData()
      formData.append('image', imageFile)
      const res = await fetch('/api/shinsa/tongue', { method: 'POST', body: formData })
      if (!res.ok) throw new Error((await res.json()).error || 'エラー')
      const data = await res.json()
      setResult(data.result); setPhase('result')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー'); setPhase('error')
    }
  }, [imageFile])

  // guide
  if (phase === 'guide') return (
    <div className="flex flex-col gap-4">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <div className="flex gap-3">
        <button onClick={() => fileInputRef.current?.click()}
          className="flex-1 border-2 border-dashed border-pink-200 rounded-xl p-4 text-center hover:bg-pink-50">
          <div className="text-2xl mb-1">🖼️</div>
          <p className="text-sm text-gray-500">アルバムから</p>
        </button>
        <button onClick={() => startCamera(facingMode)}
          className="flex-1 border-2 border-dashed border-pink-200 rounded-xl p-4 text-center hover:bg-pink-50">
          <div className="text-2xl mb-1">📷</div>
          <p className="text-sm text-gray-500">カメラで撮影</p>
        </button>
      </div>
      <button onClick={onCancel} className="text-gray-400 text-sm text-center">キャンセル</button>
    </div>
  )

  // camera
  if (phase === 'camera') return (
    <div className="flex flex-col gap-3 bg-black rounded-2xl overflow-hidden">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <canvas ref={canvasRef} className="hidden" />
      <div className="relative w-full bg-black" style={{ aspectRatio: '4/3' }}>
        <video ref={videoRef} autoPlay playsInline muted
          onCanPlay={() => setCameraReady(true)}
          className="w-full h-full object-cover"
          style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} />
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <mask id="ovalMask2">
              <rect width="100" height="100" fill="white" />
              <ellipse cx="50" cy="50" rx="36" ry="28" fill="black" />
            </mask>
          </defs>
          <rect width="100" height="100" fill="rgba(0,0,0,0.5)" mask="url(#ovalMask2)" />
          <ellipse cx="50" cy="50" rx="36" ry="28" fill="none" stroke="#f472b6" strokeWidth="0.8" strokeDasharray="3,2" />
        </svg>
        {!cameraReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="animate-spin w-8 h-8 border-2 border-pink-400 border-t-transparent rounded-full" />
          </div>
        )}
      </div>
      <div className="flex items-center justify-between px-4 py-3 bg-black">
        <button onClick={onCancel} className="text-white text-sm px-2 py-1.5">✕</button>
        <button onClick={handleShutter} disabled={!cameraReady}
          className="w-16 h-16 rounded-full bg-white border-4 border-pink-400 disabled:opacity-40 active:scale-95">
          <div className="w-12 h-12 rounded-full bg-pink-100 mx-auto" />
        </button>
        <div className="flex flex-col gap-2">
          <button onClick={() => { const f = facingMode === 'environment' ? 'user' : 'environment'; setFacingMode(f); startCamera(f) }}
            className="text-white text-xl">🔄</button>
          <button onClick={() => { stopCamera(); fileInputRef.current?.click(); setPhase('guide') }}
            className="text-white text-xs">📁</button>
        </div>
      </div>
    </div>
  )

  // preview
  if (phase === 'preview') return (
    <div className="flex flex-col gap-4 p-4 bg-white rounded-2xl border border-pink-200">
      <h3 className="font-bold text-gray-800">📷 撮影確認</h3>
      {previewUrl && <img src={previewUrl} alt="舌" className="w-full max-h-48 object-cover rounded-xl" />}
      <div className="flex gap-3">
        <button onClick={() => setPhase('guide')}
          className="flex-1 py-3 border border-gray-300 text-gray-600 rounded-xl text-sm">撮り直す</button>
        {onCaptureForBackground ? (
          <button
            onClick={() => { if (imageFile) onCaptureForBackground(imageFile, previewUrl) }}
            className="flex-1 py-3 bg-pink-500 text-white font-bold rounded-xl text-sm"
          >
            ✅ 問診に戻る（裏で分析）
          </button>
        ) : (
          <button onClick={handleAnalyze}
            className="flex-1 py-3 bg-pink-500 text-white font-bold rounded-xl text-sm">診断する</button>
        )}
      </div>
    </div>
  )

  // analyzing
  if (phase === 'analyzing') return (
    <div className="flex flex-col items-center gap-3 p-6 bg-white rounded-2xl border border-pink-200">
      <div className="text-4xl animate-pulse">🔍</div>
      <p className="font-bold text-gray-800">舌診AI分析中...</p>
      <p className="text-sm text-gray-500">10秒ほどお待ちください</p>
    </div>
  )

  // error
  if (phase === 'error') return (
    <div className="flex flex-col items-center gap-4 p-5 bg-white rounded-2xl border border-red-200">
      <p className="font-bold text-red-700">⚠️ エラー</p>
      <p className="text-sm text-gray-600">{error}</p>
      <div className="flex gap-3 w-full">
        <button onClick={() => setPhase('guide')} className="flex-1 py-2 border border-gray-300 rounded-xl text-sm">撮り直す</button>
        <button onClick={handleAnalyze} className="flex-1 py-2 bg-pink-500 text-white rounded-xl text-sm">再試行</button>
      </div>
    </div>
  )

  // result
  if (phase === 'result' && result) {
    const r = result as Record<string, string>
    return (
      <div className="flex flex-col gap-3 p-4 bg-white rounded-2xl border border-pink-200">
        <h3 className="font-bold text-gray-800">👅 舌診結果</h3>
        {previewUrl && <img src={previewUrl} alt="舌" className="w-full max-h-32 object-cover rounded-xl" />}
        <div className="bg-pink-50 rounded-xl p-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
          {r.summary || JSON.stringify(result, null, 2)}
        </div>
        <div className="flex gap-3">
          <button onClick={() => setPhase('guide')} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm">撮り直す</button>
          <button onClick={() => onComplete?.(result, previewUrl)}
            className="flex-1 py-2.5 bg-pink-500 text-white font-bold rounded-xl text-sm">✅ 記録する</button>
        </div>
      </div>
    )
  }

  return null
}
