'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { BenshoSession, Keiketu } from '@/lib/bensho/types'

export default function BenshoResult() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [session, setSession] = useState<BenshoSession | null>(null)
  const [selectedKeiketu, setSelectedKeiketu] = useState<Keiketu | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(`bensho_${id}`)
    if (stored) setSession(JSON.parse(stored))
  }, [id])

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100">
      <p className="text-stone-500">読み込み中...</p>
    </div>
  )

  const topScores = session.syndromeScores.slice(0, 3)

  return (
    <main className="min-h-screen bg-gradient-to-b from-stone-100 to-amber-50">

      {/* ヘッダー */}
      <div className="bg-amber-700 text-white px-4 py-4">
        <h1 className="font-bold text-lg">帰結弁証結果</h1>
        <p className="text-xs opacity-70 mt-0.5">
          主訴：{session.chiefComplaint}
          {session.patientName && ` / ${session.patientName}`}
          　{session.evidenceList.length}問の根拠から弁証
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* 確定した証 */}
        <div className="bg-amber-700 text-white rounded-2xl p-5 shadow-lg">
          <p className="text-xs opacity-70 mb-1">確定した証</p>
          <p className="text-2xl font-bold">{session.finalBensho || '弁証中...'}</p>
          {(session as BenshoSession & { benshoKibun?: string }).benshoKibun && (
            <p className="text-sm opacity-80 mt-2 leading-relaxed">
              {(session as BenshoSession & { benshoKibun?: string }).benshoKibun}
            </p>
          )}
        </div>

        {/* 八綱まとめ */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200">
          <p className="text-xs font-bold text-stone-500 mb-3">🔲 八綱弁証</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              ['表裏', session.hakko.hyouri],
              ['寒熱', session.hakko.kannetsu],
              ['虚実', session.hakko.kyojitsu],
              ['陰陽', session.hakko.inyo],
            ].map(([label, value]) => (
              <div key={label} className="text-center bg-stone-50 rounded-xl p-2">
                <p className="text-[10px] text-stone-400">{label}</p>
                <p className="text-sm font-bold text-amber-700 mt-0.5">{value || '—'}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 治法 */}
        {session.chiho && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200">
            <p className="text-xs font-bold text-stone-500 mb-2">💊 治法</p>
            <p className="font-bold text-stone-800">{session.chiho}</p>
            {(session as BenshoSession & { chihoReason?: string }).chihoReason && (
              <p className="text-sm text-stone-500 mt-1">
                {(session as BenshoSession & { chihoReason?: string }).chihoReason}
              </p>
            )}
          </div>
        )}

        {/* 経穴（クリックで詳細） */}
        {session.keiketu && session.keiketu.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200">
            <p className="text-xs font-bold text-stone-500 mb-3">
              📍 経穴選択
              <span className="text-[10px] font-normal ml-2">（タップで根拠を確認）</span>
            </p>
            <div className="space-y-2">
              {['主穴', '補穴', '随証穴'].map(role => {
                const keiketus = session.keiketu!.filter(k => k.role === role)
                if (keiketus.length === 0) return null
                return (
                  <div key={role}>
                    <p className="text-[10px] font-bold text-stone-400 mb-1.5">{role}</p>
                    <div className="flex flex-wrap gap-2">
                      {keiketus.map(k => (
                        <button
                          key={k.name}
                          onClick={() => setSelectedKeiketu(selectedKeiketu?.name === k.name ? null : k)}
                          className={`px-3 py-2 rounded-xl border-2 transition-all text-left ${
                            selectedKeiketu?.name === k.name
                              ? 'border-amber-500 bg-amber-50'
                              : 'border-stone-200 bg-stone-50 hover:border-amber-300'
                          }`}
                        >
                          <span className="font-bold text-stone-800 text-sm">{k.name}</span>
                          <span className="text-[10px] text-stone-400 ml-1">{k.code}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 経穴詳細パネル */}
            {selectedKeiketu && (
              <div className="mt-4 bg-amber-50 rounded-2xl p-4 border border-amber-200">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg font-bold text-amber-800">{selectedKeiketu.name}</span>
                  <span className="text-xs bg-amber-200 text-amber-700 px-2 py-0.5 rounded-full">
                    {selectedKeiketu.code}
                  </span>
                  <span className="text-xs text-stone-500">{selectedKeiketu.keiraku}</span>
                </div>

                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs font-bold text-amber-700 mb-1">✅ なぜこのつぼか</p>
                    <p className="text-stone-700 leading-relaxed">{selectedKeiketu.reason}</p>
                  </div>

                  {selectedKeiketu.action.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-amber-700 mb-1">⚡ 作用</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedKeiketu.action.map((a, i) => (
                          <span key={i} className="text-xs bg-white border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full">
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedKeiketu.comparison && (
                    <div>
                      <p className="text-xs font-bold text-amber-700 mb-1">🔄 類似穴との比較</p>
                      <p className="text-stone-600 leading-relaxed">{selectedKeiketu.comparison}</p>
                    </div>
                  )}

                  {selectedKeiketu.reference && (
                    <p className="text-xs text-stone-400">📖 {selectedKeiketu.reference}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 証候スコア */}
        {topScores.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200">
            <p className="text-xs font-bold text-stone-500 mb-3">📊 証候スコア上位</p>
            {topScores.map(s => (
              <div key={s.name} className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-bold text-stone-700">{s.name}</span>
                  <span className="text-amber-600 font-bold">{s.score}%</span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-2.5">
                  <div
                    className="bg-amber-500 h-2.5 rounded-full"
                    style={{ width: `${s.score}%` }}
                  />
                </div>
                {s.evidence.length > 0 && (
                  <p className="text-[10px] text-stone-400 mt-1">
                    根拠：{s.evidence.slice(-2).join('、')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 学習ポイント */}
        {session.learningMode && (session as BenshoSession & { learningPoints?: string[] }).learningPoints && (
          <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200">
            <p className="text-xs font-bold text-blue-700 mb-2">📚 この症例の学習ポイント</p>
            <ul className="space-y-1.5">
              {(session as BenshoSession & { learningPoints?: string[] }).learningPoints!.map((p, i) => (
                <li key={i} className="flex gap-2 text-sm text-blue-800">
                  <span className="text-blue-400 shrink-0">▶</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 注意点 */}
        {(session as BenshoSession & { notes?: string }).notes && (
          <div className="bg-orange-50 rounded-2xl p-4 border border-orange-200">
            <p className="text-xs font-bold text-orange-700 mb-2">⚠️ 注意点・申し送り</p>
            <p className="text-sm text-orange-800 leading-relaxed">
              {(session as BenshoSession & { notes?: string }).notes}
            </p>
          </div>
        )}

        {/* 問診履歴 */}
        <details className="bg-white rounded-2xl shadow-sm border border-stone-200">
          <summary className="p-4 cursor-pointer text-sm font-bold text-stone-500">
            📋 問診履歴（{session.evidenceList.length}問）
          </summary>
          <div className="px-4 pb-4 space-y-2">
            {session.evidenceList.map((e, i) => (
              <div key={i} className="bg-stone-50 rounded-xl p-3 border border-stone-100">
                <p className="text-[10px] font-bold text-stone-400">{e.category}</p>
                <p className="text-sm text-stone-700">Q: {e.question}</p>
                <p className="text-sm font-bold text-amber-700">A: {e.answer}</p>
                {session.learningMode && e.implication && (
                  <p className="text-[10px] text-stone-400 mt-1">→ {e.implication}</p>
                )}
              </div>
            ))}
          </div>
        </details>

        {/* アクションボタン */}
        <div className="flex gap-3 pb-6">
          <button
            onClick={() => window.print()}
            className="flex-1 bg-white border-2 border-stone-300 text-stone-700 font-bold py-4 rounded-2xl text-sm"
          >
            🖨️ 印刷
          </button>
          <button
            onClick={() => router.push('/bensho')}
            className="flex-1 bg-amber-600 text-white font-bold py-4 rounded-2xl text-sm"
          >
            ✅ 新しい弁証
          </button>
        </div>

      </div>
    </main>
  )
}
