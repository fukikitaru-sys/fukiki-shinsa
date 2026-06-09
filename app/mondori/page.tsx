'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MONDORI_ITEMS, getPriorityItems } from '@/lib/mondori/items'

type Phase = 'setup' | 'recording' | 'analyzing' | 'result' | 'error'

type BenshoResult = {
  hakko: { hyouri: string; kannetsu: string; kyojitsu: string; inyo: string }
  byoin: string[]
  zofu: string[]
  mondoriMatome: string
  finalBensho: string
  benshoKibun: string
  chiho: string
  keiketu: Array<{ name: string; code: string; role: string; reason: string; action: string[] }>
  notes: string
}

type SessionData = {
  id: string
  chiefComplaint: string
  patientName: string
  patientAge: string
  patientGender: string
  transcript: string
  result?: BenshoResult
  createdAt: string
}

const QUICK_COMPLAINTS = [
  '腰痛', '肩こり', '頭痛', '膝痛', '冷え',
  '疲労感', '不眠', '動悸', '便秘', '下痢',
  'めまい', '食欲不振',
]

export default function MondoriPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('setup')
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [patientName, setPatientName] = useState('')
  const [patientAge, setPatientAge] = useState('')
  const [patientGender, setPatientGender] = useState('')
  const [transcript, setTranscript] = useState('')
  const [interimText, setInterimText] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState<BenshoResult | null>(null)
  const [selectedKeiketu, setSelectedKeiketu] = useState<BenshoResult['keiketu'][0] | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const sessionRef = useRef<SessionData | null>(null)

  // 優先順位付き項目リスト
  const priorityIds = getPriorityItems(chiefComplaint)
  const sortedItems = [
    ...priorityIds.map(id => MONDORI_ITEMS.find(m => m.id === id)!).filter(Boolean),
    ...MONDORI_ITEMS.filter(m => !priorityIds.includes(m.id)),
  ]

  // リアルタイム文字起こし
  const startSpeechRecognition = useCallback(() => {
    const SR = window.SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition: typeof window.SpeechRecognition }).webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = 'ja-JP'
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e: SpeechRecognitionEvent) => {
      let final = ''
      let interim = ''
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript
        else interim += e.results[i][0].transcript
      }
      if (final) setTranscript(prev => prev + final)
      setInterimText(interim)
    }
    rec.onend = () => {
      // 録音中なら自動再起動
      if (mediaRecorderRef.current?.state === 'recording') rec.start()
    }
    rec.start()
    recognitionRef.current = rec
  }, [])

  // 録音開始
  const startRecording = useCallback(async () => {
    if (!chiefComplaint.trim()) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.start(1000)
      mediaRecorderRef.current = recorder

      setPhase('recording')
      setElapsed(0)
      setTranscript('')
      setInterimText('')
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
      startSpeechRecognition()

      // セッションを即座に作成
      const session: SessionData = {
        id: `m_${Date.now()}`,
        chiefComplaint,
        patientName,
        patientAge,
        patientGender,
        transcript: '',
        createdAt: new Date().toISOString(),
      }
      sessionRef.current = session
      localStorage.setItem(`mondori_${session.id}`, JSON.stringify(session))
    } catch {
      alert('マイクへのアクセスを許可してください')
    }
  }, [chiefComplaint, patientName, patientAge, patientGender, startSpeechRecognition])

  // 録音停止 → 文字起こしを即保存 → バックグラウンドでAI弁証
  const stopAndAnalyze = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current)
    recognitionRef.current?.stop()
    const recorder = mediaRecorderRef.current
    if (!recorder) return

    recorder.stop()
    recorder.stream.getTracks().forEach(t => t.stop())
    setPhase('analyzing')

    // ① 文字起こしを即座に保存（AIより先）
    const finalTranscript = transcript + interimText
    if (sessionRef.current) {
      const updated = { ...sessionRef.current, transcript: finalTranscript }
      sessionRef.current = updated
      localStorage.setItem(`mondori_${updated.id}`, JSON.stringify(updated))
    }

    // ② バックグラウンドでWhisper音声文字起こし（精度向上）
    await new Promise<void>(resolve => {
      recorder.onstop = () => resolve()
    })
    const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })

    let whisperTranscript = finalTranscript
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')
      const whisperRes = await fetch('/api/shinsa/analyze', {
        method: 'POST',
        body: formData,
      })
      const whisperData = await whisperRes.json()
      if (whisperData.transcript) {
        whisperTranscript = whisperData.transcript
        // Whisperの結果で上書き保存
        if (sessionRef.current) {
          const updated = { ...sessionRef.current, transcript: whisperTranscript }
          sessionRef.current = updated
          localStorage.setItem(`mondori_${updated.id}`, JSON.stringify(updated))
        }
      }
    } catch { /* Whisper失敗しても続行 */ }

    // ③ AI弁証（失敗しても文字起こしは残っている）
    try {
      const res = await fetch('/api/mondori/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: whisperTranscript,
          chiefComplaint,
          patientName,
          patientAge,
          patientGender,
        }),
      })
      const data = await res.json()

      if (data.success && data.result) {
        // 弁証結果を保存
        if (sessionRef.current) {
          const updated = { ...sessionRef.current, result: data.result }
          sessionRef.current = updated
          localStorage.setItem(`mondori_${updated.id}`, JSON.stringify(updated))
        }
        setResult(data.result)
        setTranscript(whisperTranscript)
        setPhase('result')
      } else {
        // AI失敗 → 文字起こしだけ表示
        setTranscript(whisperTranscript)
        setErrorMessage(data.error || 'AI弁証に失敗しましたが、問診記録は保存されています')
        setPhase('error')
      }
    } catch (e) {
      setTranscript(whisperTranscript)
      setErrorMessage('AI弁証でエラーが発生しましたが、問診記録は保存されています')
      setPhase('error')
    }
  }, [transcript, interimText, chiefComplaint, patientName, patientAge, patientGender])

  function formatTime(s: number) {
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
  }

  // ── SETUP ─────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <main className="min-h-screen bg-gradient-to-b from-stone-100 to-amber-50">
        <div className="text-center pt-8 pb-4">
          <h1 className="text-2xl font-bold text-stone-800">富貴氣 音声問診</h1>
          <p className="text-sm text-stone-500 mt-1">音声で問診→AI弁証</p>
        </div>

        <div className="max-w-lg mx-auto px-4 pb-10 space-y-4">
          {/* 患者情報 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200">
            <p className="text-xs font-bold text-stone-500 mb-3">患者情報</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <input type="text" value={patientName} onChange={e => setPatientName(e.target.value)}
                placeholder="氏名（任意）"
                className="col-span-2 border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
              <input type="text" value={patientAge} onChange={e => setPatientAge(e.target.value)}
                placeholder="年齢"
                className="border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
              <select value={patientGender} onChange={e => setPatientGender(e.target.value)}
                className="border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400">
                <option value="">性別</option>
                <option value="女">女性</option>
                <option value="男">男性</option>
              </select>
            </div>
          </div>

          {/* 主訴 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200">
            <p className="text-xs font-bold text-stone-500 mb-3">主訴 <span className="text-red-500">*</span></p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {QUICK_COMPLAINTS.map(c => (
                <button key={c}
                  onClick={() => setChiefComplaint(c)}
                  style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                  className={`py-3 px-2 rounded-xl text-sm font-medium border-2 transition-all active:scale-95 ${
                    chiefComplaint === c
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-stone-700 border-stone-200'
                  }`}>
                  {c}
                </button>
              ))}
            </div>
            <input type="text" value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)}
              placeholder="上記にない場合は直接入力"
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400" />
          </div>

          <button
            onClick={startRecording}
            disabled={!chiefComplaint.trim()}
            style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', minHeight: '64px' }}
            className="w-full bg-red-500 disabled:opacity-40 text-white font-bold text-lg rounded-2xl shadow-lg py-5"
          >
            🎙️ 問診を開始する
          </button>

          <button onClick={() => router.push('/')} className="w-full text-stone-400 text-sm py-2">
            ← 戻る
          </button>
        </div>
      </main>
    )
  }

  // ── RECORDING ─────────────────────────────────────
  if (phase === 'recording') {
    return (
      <main className="min-h-screen bg-stone-900 flex flex-col">
        {/* 録音ヘッダー */}
        <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
            <span className="font-bold">録音中</span>
          </div>
          <span className="font-mono text-xl">{formatTime(elapsed)}</span>
          <span className="text-sm opacity-80">{chiefComplaint} / {patientName || '患者'}</span>
        </div>

        {/* 問診項目グリッド */}
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-xs text-stone-400 mb-2 text-center">
            以下の項目を参考に音声で問診してください
          </p>
          <div className="grid grid-cols-2 gap-2">
            {sortedItems.map((item, idx) => (
              <div key={item.id}
                className={`rounded-xl p-3 border ${item.color} ${idx === 0 ? 'ring-2 ring-amber-400' : ''}`}>
                <p className={`font-bold text-sm mb-1.5 ${idx === 0 ? 'text-amber-700' : 'text-stone-700'}`}>
                  {idx === 0 && '⭐ '}{item.major}
                </p>
                <div className="space-y-0.5">
                  {item.items.map(sub => (
                    <p key={sub} className="text-xs text-stone-600">・{sub}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* リアルタイム文字起こし */}
        <div className="bg-stone-800 mx-3 mb-3 rounded-xl p-3 min-h-16 max-h-24 overflow-y-auto">
          <p className="text-xs text-stone-400 mb-1">🎤 文字起こし</p>
          <p className="text-sm text-stone-200 leading-relaxed">
            {transcript}
            {interimText && <span className="text-stone-400">{interimText}</span>}
            {!transcript && !interimText && <span className="text-stone-500">話し始めると文字が表示されます...</span>}
          </p>
        </div>

        {/* 終了ボタン */}
        <div className="p-4">
          <button
            onClick={stopAndAnalyze}
            style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', minHeight: '72px' }}
            className="w-full bg-amber-600 text-white font-bold py-5 rounded-2xl text-xl shadow-lg"
          >
            ⏹ 問診終了・弁証へ
          </button>
        </div>
      </main>
    )
  }

  // ── ANALYZING ─────────────────────────────────────
  if (phase === 'analyzing') {
    return (
      <main className="min-h-screen bg-stone-100 flex flex-col items-center justify-center gap-6 p-8">
        <div className="text-6xl animate-pulse">🔮</div>
        <div className="text-center">
          <p className="text-xl font-bold text-stone-800">AI弁証中...</p>
          <p className="text-sm text-stone-500 mt-1">問診記録はすでに保存されています</p>
        </div>
        <div className="w-full max-w-sm bg-white rounded-xl p-4 border border-stone-200">
          <p className="text-xs text-stone-400 mb-2">保存済みの問診記録</p>
          <p className="text-sm text-stone-600 leading-relaxed line-clamp-4">
            {transcript || '（処理中）'}
          </p>
        </div>
        <p className="text-xs text-stone-400">弁証に失敗しても記録は残ります</p>
      </main>
    )
  }

  // ── ERROR（AI失敗・文字起こしは残る） ──────────────
  if (phase === 'error') {
    return (
      <main className="min-h-screen bg-stone-100 flex flex-col p-4">
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-4">
          <p className="font-bold text-orange-700 mb-1">⚠️ AI弁証でエラーが発生しました</p>
          <p className="text-sm text-orange-600">{errorMessage}</p>
        </div>

        {/* 文字起こしは必ず表示 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200 mb-4 flex-1">
          <p className="text-xs font-bold text-stone-500 mb-2">📋 保存された問診記録</p>
          <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{transcript}</p>
        </div>

        <div className="flex gap-3">
          <button onClick={() => setPhase('setup')}
            className="flex-1 bg-white border-2 border-stone-300 text-stone-700 font-bold py-4 rounded-2xl text-sm">
            やり直す
          </button>
          <button onClick={() => router.push('/')}
            className="flex-1 bg-amber-600 text-white font-bold py-4 rounded-2xl text-sm">
            トップへ
          </button>
        </div>
      </main>
    )
  }

  // ── RESULT ────────────────────────────────────────
  if (phase === 'result' && result) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-stone-100 to-amber-50">
        <div className="bg-amber-700 text-white px-4 py-4">
          <h1 className="font-bold text-lg">弁証結果</h1>
          <p className="text-xs opacity-70">
            主訴：{chiefComplaint}
            {patientName && ` / ${patientName}`}
          </p>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-5 space-y-4 pb-24">

          {/* 確定した証 */}
          <div className="bg-amber-700 text-white rounded-2xl p-5 shadow-lg">
            <p className="text-xs opacity-70 mb-1">確定した証</p>
            <p className="text-2xl font-bold">{result.finalBensho}</p>
            <p className="text-sm opacity-80 mt-2 leading-relaxed">{result.benshoKibun}</p>
          </div>

          {/* 八綱 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200">
            <p className="text-xs font-bold text-stone-500 mb-3">🔲 八綱弁証</p>
            <div className="grid grid-cols-4 gap-2">
              {[['表裏', result.hakko.hyouri], ['寒熱', result.hakko.kannetsu],
                ['虚実', result.hakko.kyojitsu], ['陰陽', result.hakko.inyo]].map(([l, v]) => (
                <div key={l} className="text-center bg-stone-50 rounded-xl p-2">
                  <p className="text-[10px] text-stone-400">{l}</p>
                  <p className="text-xs font-bold text-amber-700 mt-0.5">{v || '—'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 治法 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200">
            <p className="text-xs font-bold text-stone-500 mb-2">💊 治法</p>
            <p className="font-bold text-stone-800">{result.chiho}</p>
          </div>

          {/* 経穴（クリックで根拠） */}
          {result.keiketu && result.keiketu.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200">
              <p className="text-xs font-bold text-stone-500 mb-3">
                📍 経穴
                <span className="text-[10px] font-normal ml-1">（タップで根拠）</span>
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {result.keiketu.map(k => (
                  <button key={k.name} onClick={() => setSelectedKeiketu(selectedKeiketu?.name === k.name ? null : k)}
                    className={`px-3 py-2 rounded-xl border-2 transition-all ${
                      selectedKeiketu?.name === k.name
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-stone-200 bg-stone-50 hover:border-amber-300'
                    }`}>
                    <span className="font-bold text-sm">{k.name}</span>
                    <span className={`text-[10px] ml-1 px-1.5 py-0.5 rounded-full ${
                      k.role === '主穴' ? 'bg-amber-100 text-amber-600' : 'bg-stone-100 text-stone-500'
                    }`}>{k.role}</span>
                  </button>
                ))}
              </div>
              {selectedKeiketu && (
                <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                  <p className="font-bold text-amber-800 mb-2">{selectedKeiketu.name}（{selectedKeiketu.code}）</p>
                  <p className="text-sm text-stone-700 mb-2">{selectedKeiketu.reason}</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedKeiketu.action.map((a, i) => (
                      <span key={i} className="text-xs bg-white border border-amber-200 text-amber-600 px-2 py-0.5 rounded-full">{a}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 問診まとめ */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200">
            <p className="text-xs font-bold text-stone-500 mb-2">📋 問診まとめ</p>
            <div className="space-y-1">
              {result.mondoriMatome.split(/\\n|\n/).filter(l => l.trim()).map((line, i) => (
                <p key={i} className="text-sm text-stone-700 leading-relaxed">{line}</p>
              ))}
            </div>
          </div>

          {/* 音声記録（折りたたみ） */}
          <details className="bg-white rounded-2xl shadow-sm border border-stone-200">
            <summary className="p-4 cursor-pointer text-sm font-bold text-stone-500">
              🎙️ 音声文字起こし原文
            </summary>
            <div className="px-4 pb-4">
              <p className="text-xs text-stone-500 leading-relaxed whitespace-pre-wrap">{transcript}</p>
            </div>
          </details>

          {/* 注意点 */}
          {result.notes && (
            <div className="bg-orange-50 rounded-2xl p-4 border border-orange-200">
              <p className="text-xs font-bold text-orange-700 mb-1">⚠️ 注意点</p>
              <p className="text-sm text-orange-800">{result.notes}</p>
            </div>
          )}
        </div>

        {/* 固定ボタン */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 p-4 flex gap-3">
          <button onClick={() => window.print()}
            className="flex-1 bg-white border-2 border-stone-300 text-stone-700 font-bold py-3 rounded-2xl text-sm">
            🖨️ 印刷
          </button>
          <button onClick={() => setPhase('setup')}
            className="flex-1 bg-amber-600 text-white font-bold py-3 rounded-2xl text-sm">
            ✅ 次の患者
          </button>
        </div>
      </main>
    )
  }

  return null
}
