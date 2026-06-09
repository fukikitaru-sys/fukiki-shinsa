'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BenshoSession } from '@/lib/bensho/types'

export default function BenshoTop() {
  const router = useRouter()
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [patientName, setPatientName] = useState('')
  const [learningMode, setLearningMode] = useState(false)
  const [loading, setLoading] = useState(false)

  const QUICK_COMPLAINTS = [
    '腰痛', '肩こり', '頭痛', '膝痛',
    '冷え', '疲労感', '不眠', '動悸',
    '食欲不振', '便秘', '下痢', 'めまい',
  ]

  async function startSession() {
    if (!chiefComplaint.trim()) return
    setLoading(true)

    const session: BenshoSession = {
      id: `s_${Date.now()}`,
      createdAt: new Date().toISOString(),
      patientName: patientName || undefined,
      chiefComplaint,
      currentLayer: 'hakko',
      questionHistory: [],
      evidenceList: [],
      syndromeScores: [],
      hakko: { confidence: {} },
      byoin: [],
      zofu: [],
      keiraku: [],
      kiketsuType: [],
      adlibInputs: [],
      learningMode,
    }

    // セッションをlocalStorageに保存してセッション画面へ
    localStorage.setItem(`bensho_${session.id}`, JSON.stringify(session))
    router.push(`/bensho/session/${session.id}`)
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-stone-100 to-amber-50">

      {/* ヘッダー */}
      <div className="text-center pt-10 pb-6 px-4">
        <h1 className="text-3xl font-bold text-stone-800 tracking-wider">富貴氣 弁証</h1>
        <p className="text-sm text-stone-500 mt-1">AI深掘り弁証問診システム</p>
      </div>

      <div className="max-w-lg mx-auto px-6 pb-12 space-y-6">

        {/* 患者名（任意） */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200">
          <label className="block text-sm font-bold text-stone-600 mb-2">
            患者名（任意）
          </label>
          <input
            type="text"
            value={patientName}
            onChange={e => setPatientName(e.target.value)}
            placeholder="例：田中 花子"
            className="w-full border border-stone-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:border-amber-400"
          />
        </div>

        {/* 主訴入力 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200">
          <label className="block text-sm font-bold text-stone-600 mb-3">
            主訴 <span className="text-red-500">*</span>
          </label>

          {/* クイック選択 */}
          <div className="flex flex-wrap gap-2 mb-4">
            {QUICK_COMPLAINTS.map(c => (
              <button
                key={c}
                onClick={() => setChiefComplaint(c)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                  chiefComplaint === c
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-stone-50 text-stone-600 border-stone-200 hover:border-amber-400'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* 自由入力 */}
          <input
            type="text"
            value={chiefComplaint}
            onChange={e => setChiefComplaint(e.target.value)}
            placeholder="上記にない場合は直接入力（例：右膝の内側が痛い）"
            className="w-full border border-stone-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:border-amber-400"
          />
        </div>

        {/* モード選択 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200">
          <p className="text-sm font-bold text-stone-600 mb-3">モード</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setLearningMode(false)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                !learningMode
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-stone-200 bg-white'
              }`}
            >
              <div className="text-xl mb-1">⚡</div>
              <div className="font-bold text-sm text-stone-800">診察モード</div>
              <div className="text-xs text-stone-500 mt-1">速く・シンプルに弁証</div>
            </button>
            <button
              onClick={() => setLearningMode(true)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                learningMode
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-stone-200 bg-white'
              }`}
            >
              <div className="text-xl mb-1">📚</div>
              <div className="font-bold text-sm text-stone-800">学習モード</div>
              <div className="text-xs text-stone-500 mt-1">根拠・解説・スコア表示</div>
            </button>
          </div>
        </div>

        {/* 開始ボタン */}
        <button
          onClick={startSession}
          disabled={!chiefComplaint.trim() || loading}
          className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-bold py-5 rounded-2xl text-lg shadow-lg transition-all active:scale-95"
        >
          {loading ? '準備中...' : '弁証問診を開始する'}
        </button>

        {/* 戻る */}
        <button
          onClick={() => router.push('/')}
          className="w-full text-stone-400 text-sm py-2"
        >
          ← トップに戻る
        </button>

      </div>
    </main>
  )
}
