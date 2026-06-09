'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'

type Record = {
  id: string
  patient_name: string
  patient_age: number
  patient_gender: string
  shinsa_date: string
  transcript: string
  ai_mondori: string
  ai_tongue: string
  ai_bensho: string
  ai_chiho: string
  ai_keiketu: string
  ai_notes: string
  tongue_image_url: string
  dr_bensho: string
  dr_chiho: string
  dr_keiketu: string
  dr_shujutsu: string
  dr_hyoka: string
  dr_vas: string
  dr_nrs: string
  dr_biko: string
  dr_shisetssha: string
}

function renderLines(text: string) {
  if (!text) return <span className="text-gray-300">—</span>
  return (
    <div className="space-y-1">
      {text.split(/\\n|\n/).filter(l => l.trim()).map((line, i) => (
        <p key={i} className="text-sm leading-relaxed">{line.trim()}</p>
      ))}
    </div>
  )
}

export default function RecordPage() {
  const { id } = useParams<{ id: string }>()
  const [record, setRecord] = useState<Record | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [dr, setDr] = useState({
    dr_bensho: '', dr_chiho: '', dr_keiketu: '',
    dr_shujutsu: '', dr_hyoka: '',
    dr_vas: '', dr_nrs: '', dr_biko: '', dr_shisetssha: ''
  })

  // データ取得
  useEffect(() => {
    fetch(`/api/shinsa/record?id=${id}`)
      .then(r => r.json())
      .then(data => {
        setRecord(data)
        setDr({
          dr_bensho: data.dr_bensho || '',
          dr_chiho: data.dr_chiho || '',
          dr_keiketu: data.dr_keiketu || '',
          dr_shujutsu: data.dr_shujutsu || '',
          dr_hyoka: data.dr_hyoka || '',
          dr_vas: data.dr_vas || '',
          dr_nrs: data.dr_nrs || '',
          dr_biko: data.dr_biko || '',
          dr_shisetssha: data.dr_shisetssha || '',
        })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  // AI内容をコピーして記入欄にセット
  function copyFromAI(field: keyof typeof dr, aiValue: string) {
    setDr(prev => ({ ...prev, [field]: aiValue || '' }))
  }

  // 保存
  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await fetch('/api/shinsa/save', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...dr }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch { /* エラー無視 */ }
    setSaving(false)
  }, [id, dr])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-amber-50">
      <p className="text-amber-700 animate-pulse">読み込み中...</p>
    </div>
  )

  if (!record) return (
    <div className="min-h-screen flex items-center justify-center bg-amber-50">
      <p className="text-red-600">記録が見つかりません</p>
    </div>
  )

  return (
    <>
      {/* 印刷用スタイル */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-page { page-break-after: always; }
          body { font-size: 11px; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-50">

        {/* ヘッダー（印刷非表示） */}
        <div className="no-print bg-amber-600 text-white px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow">
          <div>
            <h1 className="text-lg font-bold">{record.patient_name} さんの診察記録</h1>
            <p className="text-xs opacity-80">{record.shinsa_date} · {record.patient_age}歳 · {record.patient_gender}性</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => window.print()}
              className="bg-white text-amber-700 px-4 py-2 rounded-xl text-sm font-bold"
            >
              🖨️ 印刷
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-amber-500 hover:bg-amber-400 text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
            >
              {saving ? '保存中...' : saved ? '✅ 保存済み' : '💾 保存'}
            </button>
          </div>
        </div>

        {/* ===== 印刷ページ1: 問診・舌診・弁証 ===== */}
        <div className="print-page p-6 max-w-5xl mx-auto">

          {/* 印刷用タイトル */}
          <div className="hidden print:block text-center mb-4">
            <h2 className="text-lg font-bold">診察記録</h2>
            <p className="text-sm">{record.patient_name}　{record.patient_age}歳 {record.patient_gender}性　{record.shinsa_date}</p>
          </div>

          {/* 問診 */}
          <div className="mb-6">
            <h2 className="text-sm font-bold text-gray-700 border-b-2 border-amber-400 pb-1 mb-3">
              問診 / 聞診
              <span className="text-xs font-normal text-gray-400 ml-2">（寒熱・汗・疼痛・睡眠・飲食・口中・二便等）</span>
            </h2>
            <div className="bg-white rounded-xl p-4 border border-gray-200 text-sm text-gray-700 min-h-24">
              {renderLines(record.ai_mondori)}
            </div>
          </div>

          {/* 脈診・舌診 横並び */}
          <div className="grid grid-cols-2 gap-6 mb-6">

            {/* 舌診 */}
            <div>
              <h2 className="text-sm font-bold text-gray-700 border-b-2 border-pink-400 pb-1 mb-3">舌診</h2>
              {record.tongue_image_url && (
                <div className="w-full aspect-square bg-gray-100 rounded-xl overflow-hidden border border-gray-200 mb-3">
                  <img src={record.tongue_image_url} alt="舌診"
                    className="w-full h-full object-contain" />
                </div>
              )}
              <div className="bg-white rounded-xl p-3 border border-gray-200 text-sm text-gray-700 min-h-16">
                {renderLines(record.ai_tongue)}
              </div>
            </div>

            {/* 顔面診（空欄） */}
            <div>
              <h2 className="text-sm font-bold text-gray-700 border-b-2 border-purple-400 pb-1 mb-3">顔面診</h2>
              <div className="w-full aspect-square bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center">
                <p className="text-xs text-gray-300">（記録なし）</p>
              </div>
            </div>
          </div>

          {/* 弁証：AI vs 鍼灸師 */}
          <div className="mb-6">
            <h2 className="text-sm font-bold text-gray-700 border-b-2 border-amber-400 pb-1 mb-3">弁証</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold text-blue-600 mb-2">🤖 AI分析（参考）</p>
                <div className="bg-blue-50 rounded-xl p-3 border border-blue-200 text-sm text-gray-700 min-h-24">
                  {renderLines(record.ai_bensho)}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-amber-700 mb-2">✍️ 鍼灸師の決定</p>
                <div className="relative">
                  <textarea
                    value={dr.dr_bensho}
                    onChange={e => setDr(p => ({...p, dr_bensho: e.target.value}))}
                    placeholder="弁証を記入..."
                    className="no-print w-full bg-amber-50 rounded-xl p-3 border-2 border-amber-200 text-sm text-gray-800 min-h-24 resize-none focus:outline-none focus:border-amber-400"
                  />
                  <div className="hidden print:block bg-amber-50 rounded-xl p-3 border border-amber-200 text-sm min-h-24 whitespace-pre-wrap">
                    {dr.dr_bensho}
                  </div>
                  <button
                    onClick={() => copyFromAI('dr_bensho', record.ai_bensho)}
                    className="no-print absolute top-2 right-2 text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full hover:bg-blue-200"
                  >
                    AI参照
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== 印刷ページ2: 施術記録 ===== */}
        <div className="print-page p-6 max-w-5xl mx-auto">

          <div className="hidden print:block text-center mb-4">
            <h2 className="text-lg font-bold">施術記録</h2>
            <p className="text-sm">{record.patient_name}　{record.shinsa_date}</p>
          </div>

          {/* 治法 */}
          <div className="mb-6">
            <h2 className="text-sm font-bold text-gray-700 border-b-2 border-amber-400 pb-1 mb-3">治法の方向性</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold text-blue-600 mb-2">🤖 AI分析（参考）</p>
                <div className="bg-blue-50 rounded-xl p-3 border border-blue-200 text-sm text-gray-700 min-h-20">
                  {renderLines(record.ai_chiho)}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-amber-700 mb-2">✍️ 鍼灸師の決定</p>
                <div className="relative">
                  <textarea
                    value={dr.dr_chiho}
                    onChange={e => setDr(p => ({...p, dr_chiho: e.target.value}))}
                    placeholder="治法を記入..."
                    className="no-print w-full bg-amber-50 rounded-xl p-3 border-2 border-amber-200 text-sm min-h-20 resize-none focus:outline-none focus:border-amber-400"
                  />
                  <div className="hidden print:block bg-amber-50 rounded-xl p-3 border border-amber-200 text-sm min-h-20 whitespace-pre-wrap">{dr.dr_chiho}</div>
                  <button onClick={() => copyFromAI('dr_chiho', record.ai_chiho)}
                    className="no-print absolute top-2 right-2 text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">AI参照</button>
                </div>
              </div>
            </div>
          </div>

          {/* 経穴 */}
          <div className="mb-6">
            <h2 className="text-sm font-bold text-gray-700 border-b-2 border-amber-400 pb-1 mb-3">施術方針 / 経穴</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold text-blue-600 mb-2">🤖 AI分析（参考）</p>
                <div className="bg-blue-50 rounded-xl p-3 border border-blue-200 text-sm text-gray-700 min-h-20">
                  {renderLines(record.ai_keiketu)}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-amber-700 mb-2">✍️ 鍼灸師の決定</p>
                <div className="relative">
                  <textarea
                    value={dr.dr_keiketu}
                    onChange={e => setDr(p => ({...p, dr_keiketu: e.target.value}))}
                    placeholder="経穴を記入..."
                    className="no-print w-full bg-amber-50 rounded-xl p-3 border-2 border-amber-200 text-sm min-h-20 resize-none focus:outline-none focus:border-amber-400"
                  />
                  <div className="hidden print:block bg-amber-50 rounded-xl p-3 border border-amber-200 text-sm min-h-20 whitespace-pre-wrap">{dr.dr_keiketu}</div>
                  <button onClick={() => copyFromAI('dr_keiketu', record.ai_keiketu)}
                    className="no-print absolute top-2 right-2 text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">AI参照</button>
                </div>
              </div>
            </div>
          </div>

          {/* 施術内容 */}
          <div className="mb-6">
            <h2 className="text-sm font-bold text-gray-700 border-b-2 border-amber-400 pb-1 mb-3">施術内容</h2>
            <textarea
              value={dr.dr_shujutsu}
              onChange={e => setDr(p => ({...p, dr_shujutsu: e.target.value}))}
              placeholder="施術内容を記入..."
              className="no-print w-full bg-white rounded-xl p-4 border-2 border-gray-200 text-sm min-h-28 resize-none focus:outline-none focus:border-amber-400"
            />
            <div className="hidden print:block bg-white rounded-xl p-4 border border-gray-200 text-sm min-h-28 whitespace-pre-wrap">{dr.dr_shujutsu}</div>
          </div>

          {/* 施術評価 */}
          <div className="mb-6">
            <h2 className="text-sm font-bold text-gray-700 border-b-2 border-amber-400 pb-1 mb-3">施術評価</h2>
            <textarea
              value={dr.dr_hyoka}
              onChange={e => setDr(p => ({...p, dr_hyoka: e.target.value}))}
              placeholder="施術評価を記入..."
              className="no-print w-full bg-white rounded-xl p-4 border-2 border-gray-200 text-sm min-h-20 resize-none focus:outline-none focus:border-amber-400"
            />
            <div className="hidden print:block bg-white rounded-xl p-4 border border-gray-200 text-sm min-h-20 whitespace-pre-wrap">{dr.dr_hyoka}</div>
          </div>

          {/* VAS / NRS */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <h2 className="text-sm font-bold text-gray-700 border-b border-gray-300 pb-1 mb-2">VAS</h2>
              <input
                type="text"
                value={dr.dr_vas}
                onChange={e => setDr(p => ({...p, dr_vas: e.target.value}))}
                placeholder="例：60 → 30"
                className="no-print w-full bg-white rounded-xl p-3 border-2 border-gray-200 text-sm focus:outline-none focus:border-amber-400"
              />
              <div className="hidden print:block bg-white rounded-xl p-3 border border-gray-200 text-sm">{dr.dr_vas}</div>
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-700 border-b border-gray-300 pb-1 mb-2">NRS</h2>
              <input
                type="text"
                value={dr.dr_nrs}
                onChange={e => setDr(p => ({...p, dr_nrs: e.target.value}))}
                placeholder="例：7 → 3"
                className="no-print w-full bg-white rounded-xl p-3 border-2 border-gray-200 text-sm focus:outline-none focus:border-amber-400"
              />
              <div className="hidden print:block bg-white rounded-xl p-3 border border-gray-200 text-sm">{dr.dr_nrs}</div>
            </div>
          </div>

          {/* 備考 */}
          <div className="mb-6">
            <h2 className="text-sm font-bold text-gray-700 border-b-2 border-amber-400 pb-1 mb-3">備考</h2>
            <textarea
              value={dr.dr_biko}
              onChange={e => setDr(p => ({...p, dr_biko: e.target.value}))}
              placeholder="備考を記入..."
              className="no-print w-full bg-white rounded-xl p-4 border-2 border-gray-200 text-sm min-h-16 resize-none focus:outline-none focus:border-amber-400"
            />
            <div className="hidden print:block bg-white rounded-xl p-4 border border-gray-200 text-sm min-h-16 whitespace-pre-wrap">{dr.dr_biko}</div>
          </div>

          {/* 施術者 */}
          <div className="flex justify-end">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">施術者：</span>
              <input
                type="text"
                value={dr.dr_shisetssha}
                onChange={e => setDr(p => ({...p, dr_shisetssha: e.target.value}))}
                placeholder="施術者名"
                className="no-print bg-white rounded-xl px-3 py-2 border-2 border-gray-200 text-sm w-32 focus:outline-none focus:border-amber-400"
              />
              <div className="hidden print:block border-b border-gray-400 w-32 text-sm pb-1">{dr.dr_shisetssha}</div>
            </div>
          </div>

        </div>

        {/* 保存ボタン（下部固定） */}
        <div className="no-print fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex gap-3 justify-end">
          <button
            onClick={() => window.print()}
            className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-bold text-sm"
          >
            🖨️ 印刷
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-3 rounded-xl font-bold text-sm disabled:opacity-50"
          >
            {saving ? '保存中...' : saved ? '✅ 保存しました' : '💾 保存する'}
          </button>
        </div>

      </div>
    </>
  )
}
