'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { BenshoSession, Question, SyndromeScore } from '@/lib/bensho/types'

const LAYER_NAMES: Record<string, string> = {
  hakko: '八綱弁証', byoin: '病因病機', zofu: '臓腑・経絡弁証',
  kiketsu: '気血津液弁証', kekka: '帰結弁証', complete: '完了',
}
const LAYER_ORDER = ['hakko', 'byoin', 'zofu', 'kiketsu', 'kekka', 'complete']
const LAYER_COLORS: Record<string, string> = {
  hakko: 'bg-orange-500', byoin: 'bg-purple-500', zofu: 'bg-blue-500',
  kiketsu: 'bg-green-500', kekka: 'bg-amber-600',
}

export default function BenshoSession() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [session, setSession] = useState<BenshoSession | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [upcomingQuestions, setUpcomingQuestions] = useState<Question[]>([]) // 先読みキュー
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [freeInput, setFreeInput] = useState('')
  const [adlibInput, setAdlibInput] = useState('')
  const [showAdlib, setShowAdlib] = useState(false)
  const [showWhy, setShowWhy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [message, setMessage] = useState('')
  const [finalizing, setFinalizing] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)

  const initialized = useRef(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null)

  // セッション読み込み
  useEffect(() => {
    const stored = localStorage.getItem(`bensho_${id}`)
    if (stored) {
      const s: BenshoSession = JSON.parse(stored)
      setSession(s)
    }
  }, [id])

  useEffect(() => {
    if (session && !initialized.current) {
      initialized.current = true
      fetchNextQuestion(session)
    }
  }, [session]) // eslint-disable-line

  function saveSession(s: BenshoSession) {
    localStorage.setItem(`bensho_${s.id}`, JSON.stringify(s))
    setSession(s)
  }

  // ── 音声読み上げ ──────────────────────────────────
  const speak = useCallback((text: string) => {
    if (!voiceEnabled || typeof window === 'undefined') return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'ja-JP'
    utter.rate = 1.0
    utter.pitch = 1.0
    utter.onstart = () => setIsSpeaking(true)
    utter.onend = () => setIsSpeaking(false)
    synthRef.current = utter
    window.speechSynthesis.speak(utter)
  }, [voiceEnabled])

  // ── 音声認識 ────────────────────────────────────
  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition: typeof window.SpeechRecognition }).webkitSpeechRecognition
    if (!SR) return
    window.speechSynthesis.cancel()
    const rec = new SR()
    rec.lang = 'ja-JP'
    rec.continuous = false
    rec.interimResults = false
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const result = e.results[0][0].transcript
      setFreeInput(result)
      setSelectedAnswer('')
    }
    rec.onend = () => setIsListening(false)
    rec.onerror = () => setIsListening(false)
    rec.start()
    recognitionRef.current = rec
    setIsListening(true)
  }, [])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  // ── 先読みキューを補充 ─────────────────────────
  const preloadQuestions = useCallback(async (s: BenshoSession) => {
    try {
      const res = await fetch('/api/bensho/preload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: s }),
      })
      const data = await res.json()
      if (data.upcomingQuestions) {
        setUpcomingQuestions(data.upcomingQuestions)
      }
    } catch { /* 先読み失敗は無視 */ }
  }, [])

  // ── 次の質問を取得 ───────────────────────────────
  const fetchNextQuestion = useCallback(async (s: BenshoSession, adlib?: string) => {
    setLoading(true)
    setSelectedAnswer('')
    setFreeInput('')
    setShowWhy(false)

    try {
      // 先読みキューに使える質問があれば即座に表示
      if (upcomingQuestions.length > 0 && !adlib) {
        const next = upcomingQuestions[0]
        setCurrentQuestion(next)
        setUpcomingQuestions(prev => prev.slice(1))
        if (voiceEnabled) speak(next.voiceText || next.text)
        setLoading(false)
        // バックグラウンドで次の先読みを補充
        preloadQuestions(s)
        return
      }

      const res = await fetch('/api/bensho/question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: s, adlibInput: adlib }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const updated = { ...s, syndromeScores: data.updatedScores || s.syndromeScores }

      if (data.shouldAdvanceLayer && data.nextLayer) {
        updated.currentLayer = data.nextLayer
        if (data.nextLayer === 'complete') {
          saveSession(updated)
          finalizeSession(updated)
          return
        }
        saveSession(updated)
        setMessage(data.message || '')
        // レイヤー移行時は先読みをリセット
        setUpcomingQuestions([])
        fetchNextQuestion(updated)
      } else if (data.question) {
        saveSession(updated)
        setCurrentQuestion(data.question)
        setMessage(data.message || '')
        if (voiceEnabled) speak((data.question as Question & { voiceText?: string }).voiceText || data.question.text)
        // バックグラウンドで先読みを開始
        preloadQuestions(updated)
      }
    } catch (e) {
      alert('質問取得エラー: ' + (e instanceof Error ? e.message : ''))
    }
    setLoading(false)
  }, [upcomingQuestions, voiceEnabled, speak, preloadQuestions]) // eslint-disable-line

  // ── 回答を送信 ──────────────────────────────────
  const submitAnswer = useCallback(async (answerOverride?: string) => {
    if (!session || !currentQuestion) return
    const answer = answerOverride || selectedAnswer || freeInput
    if (!answer.trim()) return
    setLoading(true)
    window.speechSynthesis.cancel()

    try {
      const res = await fetch('/api/bensho/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session, questionId: currentQuestion.id,
          questionText: currentQuestion.text,
          questionCategory: currentQuestion.category,
          questionLayer: currentQuestion.layer,
          answer,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const updated: BenshoSession = {
        ...session,
        questionHistory: [...session.questionHistory, currentQuestion],
        evidenceList: [...session.evidenceList, data.evidence],
        syndromeScores: updateScores(session.syndromeScores, data.analysis?.scoreUpdates || []),
        hakko: updateHakko(session.hakko, data.analysis?.hakkoUpdate),
      }
      saveSession(updated)
      setCurrentQuestion(null)

      // 先読みキューの質問が回答内容に合わなくなる場合はリセット
      if (upcomingQuestions.length > 0) {
        // 軽くチェック：回答が「なし」「大丈夫」系なら先読みを更新
        const negativeAnswers = ['なし', 'ない', '大丈夫', '特にない', '正常']
        const shouldReset = negativeAnswers.some(n => answer.includes(n))
        if (shouldReset) setUpcomingQuestions([])
      }

      fetchNextQuestion(updated)
    } catch (e) {
      alert('回答処理エラー: ' + (e instanceof Error ? e.message : ''))
      setLoading(false)
    }
  }, [session, currentQuestion, selectedAnswer, freeInput, upcomingQuestions, fetchNextQuestion])

  // ── アドリブ入力 ────────────────────────────────
  const submitAdlib = useCallback(async () => {
    if (!session || !adlibInput.trim()) return
    const updated = { ...session, adlibInputs: [...session.adlibInputs, adlibInput] }
    saveSession(updated)
    setAdlibInput('')
    setShowAdlib(false)
    setCurrentQuestion(null)
    setUpcomingQuestions([]) // 先読みをリセット
    fetchNextQuestion(updated, adlibInput)
  }, [session, adlibInput, fetchNextQuestion])

  // ── 最終弁証 ────────────────────────────────────
  const finalizeSession = useCallback(async (s: BenshoSession) => {
    setFinalizing(true)
    window.speechSynthesis.cancel()
    try {
      const res = await fetch('/api/bensho/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: s }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const updated = { ...s, ...data, currentLayer: 'complete' as const }
      saveSession(updated)
      router.push(`/bensho/result/${s.id}`)
    } catch (e) {
      alert('最終弁証エラー: ' + (e instanceof Error ? e.message : ''))
      setFinalizing(false)
    }
  }, [router])

  // ── スコア更新 ──────────────────────────────────
  function updateScores(
    current: SyndromeScore[],
    updates: Array<{ name: string; delta: number; reason: string }>
  ): SyndromeScore[] {
    const map = new Map(current.map(s => [s.name, { ...s }]))
    for (const u of updates) {
      const existing = map.get(u.name)
      if (existing) {
        existing.score = Math.min(100, Math.max(0, existing.score + (u.delta || 0)))
        existing.evidence.push(u.reason)
      } else {
        map.set(u.name, { name: u.name, score: Math.max(0, u.delta || 0), evidence: [u.reason] })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.score - a.score)
  }

  function updateHakko(hakko: BenshoSession['hakko'], update: Record<string, string> | undefined) {
    if (!update) return hakko
    return {
      ...hakko,
      ...(update.hyouri && update.hyouri !== 'null' ? { hyouri: update.hyouri as BenshoSession['hakko']['hyouri'] } : {}),
      ...(update.kannetsu && update.kannetsu !== 'null' ? { kannetsu: update.kannetsu as BenshoSession['hakko']['kannetsu'] } : {}),
      ...(update.kyojitsu && update.kyojitsu !== 'null' ? { kyojitsu: update.kyojitsu as BenshoSession['hakko']['kyojitsu'] } : {}),
      ...(update.inyo && update.inyo !== 'null' ? { inyo: update.inyo as BenshoSession['hakko']['inyo'] } : {}),
    }
  }

  const layerIndex = session ? LAYER_ORDER.indexOf(session.currentLayer) : 0

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100">
      <p className="text-stone-500 animate-pulse">読み込み中...</p>
    </div>
  )

  if (finalizing) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-stone-100">
      <div className="text-6xl animate-pulse">🔮</div>
      <p className="text-xl font-bold text-stone-800">帰結弁証を行っています...</p>
      <p className="text-sm text-stone-500">全ての根拠を統合しています</p>
    </div>
  )

  return (
    <main className="min-h-screen bg-stone-100 flex flex-col">

      {/* ヘッダー */}
      <div className="bg-stone-800 text-white px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-xs opacity-60">主訴：</span>
            <span className="font-bold text-sm">{session.chiefComplaint}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* 音声ON/OFF */}
            <button
              onClick={() => { setVoiceEnabled(!voiceEnabled); window.speechSynthesis.cancel() }}
              className={`text-xs px-2 py-1 rounded-full transition-all ${voiceEnabled ? 'bg-green-500' : 'bg-stone-600'}`}
            >
              {voiceEnabled ? '🔊 音声ON' : '🔇 音声OFF'}
            </button>
            {isSpeaking && <span className="text-xs text-green-400 animate-pulse">読み上げ中</span>}
            <span className="text-xs opacity-60">{session.evidenceList.length}問</span>
          </div>
        </div>

        {/* レイヤー進捗バー */}
        <div className="flex gap-1">
          {LAYER_ORDER.slice(0, -1).map((layer, i) => (
            <div key={layer} className={`flex-1 h-1.5 rounded-full transition-all ${
              i < layerIndex ? 'bg-amber-400' :
              i === layerIndex ? `${LAYER_COLORS[layer]}` : 'bg-stone-600'
            }`} />
          ))}
        </div>
        <p className="text-xs text-center mt-1 opacity-70">{LAYER_NAMES[session.currentLayer]}</p>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

        {/* メイン */}
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">

          {/* レイヤー表示 */}
          <div className={`text-white rounded-2xl px-4 py-2.5 ${LAYER_COLORS[session.currentLayer] || 'bg-stone-500'}`}>
            <p className="font-bold text-sm">{LAYER_NAMES[session.currentLayer]}</p>
            {message && <p className="text-xs opacity-80">{message}</p>}
          </div>

          {/* ローディング */}
          {loading && (
            <div className="bg-white rounded-2xl p-5 flex items-center justify-center gap-3">
              <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-stone-500 text-sm">次の質問を準備中...</p>
            </div>
          )}

          {/* 現在の質問カード */}
          {!loading && currentQuestion && (
            <div className="bg-white rounded-2xl shadow border border-stone-200 overflow-hidden">
              <div className="bg-stone-50 px-4 py-2.5 border-b border-stone-200 flex items-center justify-between">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${LAYER_COLORS[currentQuestion.layer] || 'bg-stone-500'}`}>
                  {currentQuestion.category}
                </span>
                <div className="flex items-center gap-2">
                  {voiceEnabled && (
                    <button
                      onClick={() => speak((currentQuestion as Question & { voiceText?: string }).voiceText || currentQuestion.text)}
                      className="text-xs text-green-600"
                    >
                      🔊
                    </button>
                  )}
                  {session.learningMode && (
                    <button onClick={() => setShowWhy(!showWhy)} className="text-xs text-blue-600 underline">
                      💡 なぜ？
                    </button>
                  )}
                </div>
              </div>

              <div className="p-5">
                <p className="text-lg font-bold text-stone-800 leading-relaxed mb-4">
                  {currentQuestion.text}
                </p>

                {session.learningMode && showWhy && (
                  <div className="bg-blue-50 rounded-xl p-3 border border-blue-200 mb-4">
                    <p className="text-xs font-bold text-blue-700 mb-1">💡 この質問の意味</p>
                    <p className="text-sm text-blue-800">{currentQuestion.why}</p>
                  </div>
                )}

                {/* 選択肢 */}
                {currentQuestion.choices && (
                  <div className="space-y-2 mb-4">
                    {currentQuestion.choices.map(choice => (
                      <button
                        key={choice.id}
                        onClick={() => { setSelectedAnswer(choice.label); setFreeInput('') }}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                          selectedAnswer === choice.label
                            ? 'border-amber-500 bg-amber-50'
                            : 'border-stone-200 bg-white hover:border-stone-300'
                        }`}
                      >
                        <p className="font-medium text-stone-800 text-sm">{choice.label}</p>
                        {choice.hint && <p className="text-xs text-stone-400 mt-0.5">{choice.hint}</p>}
                      </button>
                    ))}
                  </div>
                )}

                {/* 音声入力 + テキスト入力 */}
                {currentQuestion.allowFreeInput && (
                  <div className="mb-4 flex gap-2">
                    <input
                      type="text"
                      value={freeInput}
                      onChange={e => { setFreeInput(e.target.value); setSelectedAnswer('') }}
                      placeholder="自由に回答、または音声入力..."
                      className="flex-1 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-400"
                      onKeyDown={e => { if (e.key === 'Enter' && freeInput.trim()) submitAnswer() }}
                    />
                    <button
                      onPointerDown={startListening}
                      onPointerUp={stopListening}
                      className={`px-4 rounded-xl text-xl transition-all ${
                        isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      🎤
                    </button>
                  </div>
                )}
                {isListening && (
                  <p className="text-xs text-red-500 text-center mb-3 animate-pulse">🔴 話してください...</p>
                )}

                <button
                  onClick={() => submitAnswer()}
                  disabled={!selectedAnswer && !freeInput.trim()}
                  className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl"
                >
                  回答する
                </button>
              </div>
            </div>
          )}

          {/* 先読みキュー（樹形図形式） */}
          {upcomingQuestions.length > 0 && !loading && (
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-4">
              <p className="text-xs font-bold text-stone-400 mb-3">
                📋 次に予定している質問（{upcomingQuestions.length}問先読み中）
              </p>
              <div className="space-y-2">
                {upcomingQuestions.map((q, i) => (
                  <div key={q.id} className="flex items-start gap-3">
                    {/* 樹形図の線 */}
                    <div className="flex flex-col items-center shrink-0 mt-1">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                        i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-amber-300' : 'bg-stone-300'
                      }`}>
                        {i + 2}
                      </div>
                      {i < upcomingQuestions.length - 1 && (
                        <div className="w-0.5 h-4 bg-stone-200 mt-0.5" />
                      )}
                    </div>
                    <div className={`flex-1 rounded-xl p-2.5 text-xs transition-all ${
                      i === 0 ? 'bg-amber-50 border border-amber-200' : 'bg-stone-50 border border-stone-100'
                    }`}>
                      <span className={`font-bold mr-2 ${i === 0 ? 'text-amber-600' : 'text-stone-400'}`}>
                        {q.category}
                      </span>
                      <span className={i === 0 ? 'text-stone-700' : 'text-stone-400'}>
                        {q.text}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-stone-300 mt-2 text-center">
                回答内容によって変化します
              </p>
            </div>
          )}

          {/* アドリブ入力 */}
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-4">
            <button
              onClick={() => setShowAdlib(!showAdlib)}
              className="w-full text-left flex items-center justify-between"
            >
              <span className="text-sm font-bold text-stone-600">💬 気になることを追加</span>
              <span className="text-stone-400 text-xs">{showAdlib ? '▲' : '▼'}</span>
            </button>
            {showAdlib && (
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={adlibInput}
                  onChange={e => setAdlibInput(e.target.value)}
                  placeholder="例：耳鳴りがある、夢をよく見る..."
                  className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
                  onKeyDown={e => { if (e.key === 'Enter') submitAdlib() }}
                />
                <button
                  onClick={submitAdlib}
                  disabled={!adlibInput.trim()}
                  className="bg-stone-600 text-white px-4 rounded-xl text-sm disabled:opacity-40"
                >
                  追加
                </button>
              </div>
            )}
          </div>

          {/* 帰結弁証ボタン */}
          {session.evidenceList.length >= 8 && !loading && (
            <button
              onClick={() => finalizeSession(session)}
              className="w-full bg-amber-700 hover:bg-amber-800 text-white font-bold py-4 rounded-2xl shadow text-sm"
            >
              🔮 今の根拠で帰結弁証する（{session.evidenceList.length}問分の根拠）
            </button>
          )}
        </div>

        {/* 学習モード：サイドパネル */}
        {session.learningMode && (
          <div className="lg:w-72 bg-white border-t lg:border-t-0 lg:border-l border-stone-200 p-4 overflow-y-auto">
            <div className="mb-5">
              <p className="text-xs font-bold text-stone-500 mb-3">📊 証候スコア</p>
              {session.syndromeScores.slice(0, 6).map(s => (
                <div key={s.name} className="mb-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-stone-700">{s.name}</span>
                    <span className="text-amber-600">{s.score}%</span>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-2">
                    <div className="bg-amber-500 h-2 rounded-full transition-all" style={{ width: `${s.score}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-5">
              <p className="text-xs font-bold text-stone-500 mb-3">🔲 八綱弁証</p>
              {[['表裏', session.hakko.hyouri], ['寒熱', session.hakko.kannetsu],
                ['虚実', session.hakko.kyojitsu], ['陰陽', session.hakko.inyo]].map(([l, v]) => (
                <div key={l} className="flex justify-between text-xs mb-1.5">
                  <span className="text-stone-500">{l}</span>
                  <span className={`font-bold ${v ? 'text-amber-600' : 'text-stone-300'}`}>{v || '未確定'}</span>
                </div>
              ))}
            </div>

            <div>
              <p className="text-xs font-bold text-stone-500 mb-2">📋 根拠（{session.evidenceList.length}件）</p>
              <div className="space-y-2">
                {session.evidenceList.slice(-5).reverse().map((e, i) => (
                  <div key={i} className="bg-stone-50 rounded-xl p-2.5 border border-stone-100">
                    <p className="text-[10px] font-bold text-stone-500">{e.category}</p>
                    <p className="text-xs font-medium text-stone-700">「{e.answer}」</p>
                    <p className="text-[10px] text-stone-400 mt-0.5">{e.implication}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
