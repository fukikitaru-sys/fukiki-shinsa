'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import TongueDiagnosis from '@/app/components/TongueDiagnosis'
import MondoriGuide from '@/app/components/MondoriGuide'

type Phase = 'ready' | 'recording' | 'tongue' | 'analyzing' | 'result'

type TongueStatus = 'none' | 'analyzing' | 'done' | 'error'

type DiagnosisResult = {
  mondori: string
  tongue: string
  bensho: string
  chiho: string
  keiketu: string
  notes: string
}

const PATIENTS: Record<string, { name: string; age: number; gender: string }> = {
  '1': { name: '田中 花子', age: 52, gender: '女' },
  '2': { name: '田中 一郎', age: 45, gender: '男' },
  '3': { name: '山田 美咲', age: 38, gender: '女' },
  '4': { name: '佐藤 健', age: 60, gender: '男' },
  '5': { name: '鈴木 幸子', age: 67, gender: '女' },
  '6': { name: '伊藤 次郎', age: 41, gender: '男' },
}

export default function ShinsaPage() {
  const { patientId } = useParams<{ patientId: string }>()
  const router = useRouter()
  const patient = PATIENTS[patientId] ?? { name: '不明', age: 0, gender: '-' }

  const [phase, setPhase] = useState<Phase>('ready')
  const [liveTranscript, setLiveTranscript] = useState('')  // リアルタイム文字起こし（問診ガイド用）
  const [tongueStatus, setTongueStatus] = useState<TongueStatus>('none')
  const [tongueResult, setTongueResult] = useState<Record<string, unknown> | null>(null)
  const [tongueImageUrl, setTongueImageUrl] = useState('')
  const [result, setResult] = useState<DiagnosisResult | null>(null)
  const [transcript, setTranscript] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [tongueNotify, setTongueNotify] = useState(false) // 舌診完了通知

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // リアルタイム文字起こし用（SpeechRecognition）
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  // ── リアルタイム文字起こし（問診ガイド用） ──
  const startLiveTranscript = useCallback(() => {
    const SR = window.SpeechRecognition || (window as unknown as { webkitSpeechRecognition: typeof window.SpeechRecognition }).webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = 'ja-JP'
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const text = Array.from(e.results).map((r: SpeechRecognitionResult) => r[0].transcript).join(' ')
      setLiveTranscript(text)
    }
    rec.onend = () => { if (phase === 'recording') rec.start() }
    rec.start()
    recognitionRef.current = rec
  }, [phase])

  const stopLiveTranscript = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
  }, [])

  // ── 録音開始 ──
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.start(1000)
      mediaRecorderRef.current = recorder
      setPhase('recording')
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
      startLiveTranscript()
    } catch {
      alert('マイクへのアクセスを許可してください')
    }
  }, [startLiveTranscript])

  // ── 舌診：撮影後すぐ問診継続・裏でAI分析 ──
  const handleTongueCapture = useCallback(async (imgFile: File, previewUrl: string) => {
    setTongueImageUrl(previewUrl)
    setTongueStatus('analyzing')
    setPhase('recording') // 即座に問診に戻る

    // 裏でAI分析
    try {
      const formData = new FormData()
      formData.append('image', imgFile)
      const res = await fetch('/api/shinsa/tongue', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setTongueResult(data.result)
      setTongueStatus('done')
      setTongueNotify(true) // 完了通知
      setTimeout(() => setTongueNotify(false), 4000)
    } catch {
      setTongueStatus('error')
    }
  }, [])

  // ── 録音停止→AI解析 ──
  const stopAndAnalyze = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current)
    stopLiveTranscript()
    const recorder = mediaRecorderRef.current
    if (!recorder) return

    setPhase('analyzing')

    const audioBlob = await new Promise<Blob>(resolve => {
      recorder.onstop = () => resolve(new Blob(chunksRef.current, { type: 'audio/webm' }))
      recorder.stop()
      recorder.stream.getTracks().forEach(t => t.stop())
    })

    const formData = new FormData()
    formData.append('audio', audioBlob, 'recording.webm')
    formData.append('patient_name', patient.name)
    formData.append('patient_age', String(patient.age))
    formData.append('patient_gender', patient.gender)
    if (tongueResult) formData.append('tongue_result', JSON.stringify(tongueResult))

    try {
      const res = await fetch('/api/shinsa/analyze', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data.result)
      setTranscript(data.transcript || '')

      // Supabaseに自動保存
      const saveRes = await fetch('/api/shinsa/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          patient_name: patient.name,
          patient_age: patient.age,
          patient_gender: patient.gender,
          transcript: data.transcript || '',
          ai_mondori: data.result.mondori || '',
          ai_tongue: data.result.tongue || '',
          ai_bensho: data.result.bensho || '',
          ai_chiho: data.result.chiho || '',
          ai_keiketu: data.result.keiketu || '',
          ai_notes: data.result.notes || '',
          tongue_image_url: tongueImageUrl || '',
        }),
      })
      const saveData = await saveRes.json()
      if (saveData.id) {
        // 保存成功→PC編集ページに遷移
        router.push(`/record/${saveData.id}`)
      } else {
        setPhase('result')
      }
    } catch (e) {
      alert('解析エラー: ' + (e instanceof Error ? e.message : ''))
      setPhase('recording')
    }
  }, [patient, tongueResult, stopLiveTranscript])

  function formatTime(s: number) {
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
  }

  // ── READY ──────────────────────────────────────────
  if (phase === 'ready') {
    return (
      <main className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex flex-col">
        <div className="flex items-center gap-3 px-4 pt-8 pb-4">
          <button onClick={() => router.push('/')} className="text-amber-700 text-2xl">←</button>
          <h2 className="text-lg font-bold text-amber-800">診察準備</h2>
        </div>

        <div className="mx-4 bg-white rounded-2xl p-5 shadow-sm border border-amber-100 mb-6">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold ${
              patient.gender === '女' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'
            }`}>
              {patient.name[0]}
            </div>
            <div>
              <div className="text-xl font-bold text-gray-800">{patient.name}</div>
              <div className="text-sm text-gray-500">{patient.age}歳 · {patient.gender}性</div>
            </div>
          </div>
        </div>

        <div className="mx-4 bg-amber-50 rounded-2xl p-4 border border-amber-200 mb-8">
          <p className="text-sm text-amber-800 font-medium mb-2">📋 診察の流れ</p>
          <ol className="text-sm text-amber-700 space-y-1.5">
            <li>1. 「診察開始」を押すと録音・問診ガイドがスタート</li>
            <li>2. ガイドを参考に会話しながら診察を進める</li>
            <li>3. 「舌診」ボタンで撮影→すぐ問診に戻れる（裏で分析）</li>
            <li>4. 「解析する」でAIが総合弁証</li>
          </ol>
        </div>

        <div className="flex-1 flex items-center justify-center px-6">
          <button
            onClick={startRecording}
            className="w-full max-w-sm bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-2xl p-8 shadow-lg transition-all text-center"
          >
            <div className="text-5xl mb-3">🎙️</div>
            <div className="text-2xl font-bold">診察開始</div>
            <div className="text-sm opacity-80 mt-1">タップして録音スタート</div>
          </button>
        </div>
      </main>
    )
  }

  // ── RECORDING ──────────────────────────────────────
  if (phase === 'recording' || phase === 'tongue') {
    return (
      <main className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex flex-col">

        {/* 録音中ヘッダー */}
        <div className="bg-red-500 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
            <span className="font-bold text-sm">録音中</span>
          </div>
          <span className="font-mono text-lg">{formatTime(elapsed)}</span>
          <span className="text-sm opacity-90">{patient.name}</span>
        </div>

        {/* 舌診完了通知 */}
        {tongueNotify && (
          <div className="mx-4 mt-3 bg-green-500 text-white rounded-2xl px-4 py-3 flex items-center gap-2 shadow animate-pulse">
            <span>✅</span>
            <span className="text-sm font-bold">舌診AI分析が完了しました！</span>
          </div>
        )}

        <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">

          {/* 舌診エリア */}
          {phase === 'tongue' ? (
            <div className="bg-white rounded-2xl shadow-sm border border-pink-200 p-4">
              <TongueDiagnosis
                onCaptureForBackground={handleTongueCapture}
                onCancel={() => setPhase('recording')}
              />
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-700">舌診</p>
                  {tongueStatus === 'none' && <p className="text-xs text-gray-400">まだ撮影していません</p>}
                  {tongueStatus === 'analyzing' && (
                    <p className="text-xs text-blue-500 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse inline-block" />
                      AI分析中（問診を続けてください）
                    </p>
                  )}
                  {tongueStatus === 'done' && <p className="text-xs text-green-600">✅ 分析完了</p>}
                  {tongueStatus === 'error' && <p className="text-xs text-red-500">⚠️ 分析エラー（再撮影できます）</p>}
                </div>
                <div className="flex items-center gap-2">
                  {tongueImageUrl && (
                    <img src={tongueImageUrl} alt="舌" className="w-12 h-12 rounded-xl object-cover border border-pink-200" />
                  )}
                  <button
                    onClick={() => setPhase('tongue')}
                    className="bg-pink-100 hover:bg-pink-200 text-pink-700 px-4 py-2 rounded-xl font-medium text-sm"
                  >
                    👅 {tongueStatus === 'none' ? '舌診' : '撮り直す'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 問診ガイド */}
          {phase === 'recording' && (
            <MondoriGuide
              transcript={liveTranscript}
              isRecording={phase === 'recording'}
            />
          )}

          {/* 録音中の波形 */}
          {phase === 'recording' && (
            <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-4 flex items-center justify-center gap-1">
              {[...Array(7)].map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 bg-amber-400 rounded-full animate-pulse"
                  style={{ height: `${16 + (i % 3) * 8}px`, animationDelay: `${i * 0.12}s` }}
                />
              ))}
              <p className="text-xs text-gray-400 ml-3">録音中・会話を拾っています</p>
            </div>
          )}
        </div>

        {/* 解析ボタン */}
        {phase === 'recording' && (
          <div className="p-4">
            {tongueStatus === 'analyzing' && (
              <p className="text-xs text-blue-500 text-center mb-2">
                ⏳ 舌診分析中ですが、そのまま解析に進めます
              </p>
            )}
            <button
              onClick={stopAndAnalyze}
              className="w-full bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-2xl py-5 text-xl font-bold shadow-lg transition-all"
            >
              ⏹ 診察終了・AI解析へ
            </button>
          </div>
        )}
      </main>
    )
  }

  // ── ANALYZING ──────────────────────────────────────
  if (phase === 'analyzing') {
    return (
      <main className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex flex-col items-center justify-center gap-6 p-8">
        <div className="text-6xl animate-pulse">🔍</div>
        <div className="text-center">
          <p className="text-xl font-bold text-amber-800">AIが解析中です</p>
          <p className="text-sm text-amber-600 mt-2">音声・舌診・問診情報を総合して弁証しています</p>
        </div>
        <div className="flex gap-3">
          {['音声文字起こし', '問診整理', '舌診分析', '弁証'].map((step, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-amber-200 animate-pulse flex items-center justify-center text-xs font-bold text-amber-700">
                {i + 1}
              </div>
              <span className="text-[10px] text-amber-600">{step}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400">10〜30秒ほどお待ちください</p>
      </main>
    )
  }

  // ── RESULT ──────────────────────────────────────────
  if (phase === 'result' && result) {

    return (
      <main className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex flex-col">
        <div className="flex items-center gap-3 px-4 pt-6 pb-4">
          <button onClick={() => router.push('/')} className="text-amber-700 text-2xl">←</button>
          <div>
            <h2 className="text-lg font-bold text-amber-800">弁証結果</h2>
            <p className="text-xs text-amber-600">{patient.name}・{patient.age}歳・{patient.gender}性</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">

          {/* 弁証（メイン） */}
          <div className="bg-amber-600 text-white rounded-2xl p-5 shadow">
            <p className="text-xs opacity-70 mb-2 font-medium">🏥 病態把握・弁証</p>
            <div className="space-y-2">
              {result.bensho
                ? result.bensho.split(/\\n|\n/).filter(l => l.trim()).map((line, i) => (
                    <p key={i} className="text-sm leading-relaxed">{line.trim()}</p>
                  ))
                : <p className="text-sm opacity-80">（情報不足のため弁証できませんでした）</p>
              }
            </div>
          </div>

          {/* 治法 */}
          {result.chiho && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-amber-200">
              <p className="text-xs font-bold text-amber-700 mb-2">💊 治法の方向性</p>
              <div className="space-y-1.5">
                {result.chiho.split(/\\n|\n|[・、]/).filter(l => l.trim()).map((line, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-amber-400 mt-0.5 shrink-0">▶</span>
                    <p className="text-sm text-gray-800 leading-relaxed">{line.trim()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 経穴 */}
          {result.keiketu && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-amber-200">
              <p className="text-xs font-bold text-amber-700 mb-2">📍 参考経穴</p>
              <div className="space-y-1.5">
                {result.keiketu.split(/\\n|\n/).filter(l => l.trim()).map((line, i) => (
                  <p key={i} className="text-sm text-gray-800 leading-relaxed">{line.trim()}</p>
                ))}
              </div>
            </div>
          )}

          {/* 舌診写真＋所見 */}
          {tongueImageUrl && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-pink-100">
              <p className="text-xs font-bold text-pink-600 mb-3">👅 舌診</p>
              {/* 正方形で表示 */}
              <div className="w-full aspect-square overflow-hidden rounded-xl mb-3 bg-gray-100">
                <img
                  src={tongueImageUrl}
                  alt="舌診"
                  className="w-full h-full object-contain"
                />
              </div>
              {result.tongue && (
                <div className="space-y-1">
                  {result.tongue.split(/\\n|\n/).filter((l: string) => l.trim()).map((line: string, i: number) => (
                    <p key={i} className="text-sm text-gray-700 leading-relaxed">{line.trim()}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 問診まとめ */}
          {result.mondori && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
              <p className="text-xs font-bold text-gray-600 mb-2">📋 問診まとめ</p>
              <div className="space-y-1.5">
                {result.mondori.split(/\\n|\n/).filter((l: string) => l.trim()).map((line: string, i: number) => (
                  <p key={i} className="text-sm text-gray-700 leading-relaxed">{line.trim()}</p>
                ))}
              </div>
            </div>
          )}

          {/* 備考・申し送り */}
          {result.notes && (
            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
              <p className="text-xs font-bold text-amber-700 mb-2">⚠️ 注意点・次回申し送り</p>
              <div className="space-y-1">
                {result.notes.split(/\\n|\n/).filter((l: string) => l.trim()).map((line: string, i: number) => (
                  <p key={i} className="text-sm text-amber-800 leading-relaxed">{line.trim()}</p>
                ))}
              </div>
            </div>
          )}

          {/* 音声文字起こし */}
          {transcript && (
            <details className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <summary className="text-xs font-bold text-gray-400 cursor-pointer">🎙️ 音声文字起こし</summary>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed whitespace-pre-wrap">{transcript}</p>
            </details>
          )}
        </div>

        <div className="p-4 flex gap-3">
          <button onClick={() => window.print()}
            className="flex-1 bg-white border-2 border-amber-300 text-amber-700 font-bold py-4 rounded-2xl text-sm">
            🖨️ 印刷
          </button>
          <button onClick={() => router.push('/')}
            className="flex-1 bg-amber-600 text-white font-bold py-4 rounded-2xl text-sm">
            ✅ 完了
          </button>
        </div>
      </main>
    )
  }

  return null
}
