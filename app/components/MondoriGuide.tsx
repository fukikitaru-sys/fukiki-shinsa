'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

type GuideQuestion = {
  category: string
  question: string
  reason: string
  priority: 'high' | 'normal'
}

type GuideResult = {
  collected: string[]
  questions: GuideQuestion[]
}

interface Props {
  transcript: string
  isRecording: boolean
}

// ── 十問歌：最初から表示する静的ガイド ──────────────
const INITIAL_GUIDE: GuideResult = {
  collected: [],
  questions: [
    { category: '主訴',   question: '今日はどこが一番つらいですか？', reason: 'まず主訴を確認', priority: 'high' },
    { category: '寒熱',   question: '寒がりですか、暑がりですか？', reason: '寒熱の判別', priority: 'high' },
    { category: '汗',     question: '汗はよくかきますか？夜中に汗をかくことはありますか？', reason: '津液・陰虚の判断', priority: 'high' },
    { category: '睡眠',   question: '眠れていますか？寝つきや目覚めはどうですか？', reason: '心神・肝の状態', priority: 'normal' },
    { category: '飲食',   question: '食欲はありますか？食後に疲れたり、胃がもたれたりしますか？', reason: '脾胃の機能', priority: 'normal' },
    { category: '大便',   question: '便は毎日出ていますか？かたさや色はどうですか？', reason: '大腸・脾の状態', priority: 'normal' },
    { category: '小便',   question: '尿の色や回数、夜間尿はありますか？', reason: '腎・膀胱の状態', priority: 'normal' },
    { category: '頭身',   question: '頭痛やめまい、疲れやすさはありますか？', reason: '気血の状態', priority: 'normal' },
    { category: '胸腹',   question: 'のどや胸のつかえ感、腹部の不快感はありますか？', reason: '気滞・痰の判断', priority: 'normal' },
    { category: '既往歴', question: '以前にかかった大きな病気や、常用している薬はありますか？', reason: '体質把握', priority: 'normal' },
  ]
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  主訴:   { bg: 'bg-pink-50',    text: 'text-pink-700',   border: 'border-pink-200' },
  寒熱:   { bg: 'bg-orange-50',  text: 'text-orange-700', border: 'border-orange-200' },
  汗:     { bg: 'bg-blue-50',    text: 'text-blue-700',   border: 'border-blue-200' },
  頭身:   { bg: 'bg-purple-50',  text: 'text-purple-700', border: 'border-purple-200' },
  飲食:   { bg: 'bg-green-50',   text: 'text-green-700',  border: 'border-green-200' },
  大便:   { bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200' },
  小便:   { bg: 'bg-yellow-50',  text: 'text-yellow-700', border: 'border-yellow-200' },
  睡眠:   { bg: 'bg-indigo-50',  text: 'text-indigo-700', border: 'border-indigo-200' },
  胸腹:   { bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-200' },
  既往歴: { bg: 'bg-gray-50',    text: 'text-gray-600',   border: 'border-gray-200' },
  月経:   { bg: 'bg-rose-50',    text: 'text-rose-700',   border: 'border-rose-200' },
  default:{ bg: 'bg-gray-50',    text: 'text-gray-600',   border: 'border-gray-200' },
}

function getColor(category: string) {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.default
}

export default function MondoriGuide({ transcript, isRecording }: Props) {
  // 最初から静的ガイドを表示
  const [guide, setGuide] = useState<GuideResult>(INITIAL_GUIDE)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState('')
  const [isOpen, setIsOpen] = useState(true)
  const [aiUpdated, setAiUpdated] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastFetchedRef = useRef('')
  const lastLengthRef = useRef(0)

  const fetchGuide = useCallback(async (text: string) => {
    if (!text || text === lastFetchedRef.current) return
    if (text.length < 20) return  // 短すぎる場合はスキップ
    lastFetchedRef.current = text
    setLoading(true)
    try {
      const res = await fetch('/api/shinsa/mondori-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.questions && data.questions.length > 0) {
          setGuide(data)
          setAiUpdated(true)
          setTimeout(() => setAiUpdated(false), 3000)
        }
      }
    } catch { /* 無視 */ }
    setLoading(false)
  }, [])

  // transcript変化時にデバウンスでAI更新
  useEffect(() => {
    if (!isRecording) return
    const diff = transcript.length - lastLengthRef.current
    if (diff < 30) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      lastLengthRef.current = transcript.length
      fetchGuide(transcript)
    }, 3000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [transcript, isRecording, fetchGuide])

  // 録音停止時は静的ガイドにリセット
  useEffect(() => {
    if (!isRecording) {
      setGuide(INITIAL_GUIDE)
      setAiUpdated(false)
      lastLengthRef.current = 0
      lastFetchedRef.current = ''
    }
  }, [isRecording])

  function copyQuestion(q: string) {
    navigator.clipboard.writeText(q).catch(() => {})
    setCopied(q)
    setTimeout(() => setCopied(''), 2000)
  }

  if (!isRecording) return null

  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 overflow-hidden">
      {/* ヘッダー */}
      <button
        onClick={() => setIsOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-indigo-100 border-b border-indigo-200"
      >
        <span className="text-sm">💡</span>
        <span className="text-xs font-bold text-indigo-800">問診ガイド（十問歌）</span>
        {loading && (
          <div className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin ml-1" />
        )}
        {aiUpdated && (
          <span className="text-[10px] text-green-600 ml-1">✨ AI更新</span>
        )}
        <span className="ml-auto text-indigo-400 text-xs">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="p-3 space-y-3">

          {/* 確認済み */}
          {guide.collected.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-indigo-500 mb-1.5">✓ 確認済み</p>
              <div className="flex flex-wrap gap-1.5">
                {guide.collected.map((item, i) => (
                  <span key={i} className="text-[10px] bg-white text-indigo-400 border border-indigo-200 px-2 py-0.5 rounded-full line-through">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 質問リスト */}
          <div>
            {!aiUpdated && transcript.length < 20 && (
              <p className="text-[10px] text-indigo-400 mb-2">
                📝 十問歌の基本項目です。会話が増えるとAIが自動更新します
              </p>
            )}
            <div className="space-y-2">
              {guide.questions.map((q, i) => {
                const color = getColor(q.category)
                const isCopied = copied === q.question
                return (
                  <button
                    key={i}
                    onClick={() => copyQuestion(q.question)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all active:scale-[0.98] ${
                      isCopied ? 'bg-green-50 border-green-300' : `${color.bg} ${color.border} hover:brightness-95`
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full ${
                        q.priority === 'high' ? 'bg-red-400' : 'bg-gray-300'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${color.bg} ${color.text} ${color.border}`}>
                            {q.category}
                          </span>
                          <span className="text-[10px] text-gray-400">{q.reason}</span>
                        </div>
                        <p className={`text-sm font-medium leading-snug ${isCopied ? 'text-green-700' : 'text-gray-800'}`}>
                          {isCopied ? '✅ コピーしました' : q.question}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <p className="text-[10px] text-indigo-400 text-center">
            質問をタップするとコピーできます
          </p>
        </div>
      )}
    </div>
  )
}
