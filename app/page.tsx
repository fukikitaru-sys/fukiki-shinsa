'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

// ── 型定義 ──────────────────────────────────────────
type Patient = {
  id: string
  name: string
  kana: string
  age: number
  gender: '男' | '女'
  lastVisit?: string
}

// ── サンプルデータ（後でSupabase連携） ──────────────
const SAMPLE_PATIENTS: Patient[] = [
  { id: '1', name: '田中 花子', kana: 'たなか はなこ', age: 52, gender: '女', lastVisit: '2026/06/05' },
  { id: '2', name: '田中 一郎', kana: 'たなか いちろう', age: 45, gender: '男', lastVisit: '2026/06/03' },
  { id: '3', name: '山田 美咲', kana: 'やまだ みさき', age: 38, gender: '女', lastVisit: '2026/06/01' },
  { id: '4', name: '佐藤 健', kana: 'さとう けん', age: 60, gender: '男', lastVisit: '2026/05/28' },
  { id: '5', name: '鈴木 幸子', kana: 'すずき さちこ', age: 67, gender: '女', lastVisit: '2026/05/25' },
  { id: '6', name: '伊藤 次郎', kana: 'いとう じろう', age: 41, gender: '男', lastVisit: '2026/05/20' },
]

const KANA_ROWS = ['あ', 'か', 'さ', 'た', 'な', 'は', 'ま', 'や', 'ら', 'わ']

function getKanaRow(kana: string): string {
  const first = kana[0]
  if ('あいうえお'.includes(first)) return 'あ'
  if ('かきくけこ'.includes(first)) return 'か'
  if ('さしすせそ'.includes(first)) return 'さ'
  if ('たちつてと'.includes(first)) return 'た'
  if ('なにぬねの'.includes(first)) return 'な'
  if ('はひふへほ'.includes(first)) return 'は'
  if ('まみむめも'.includes(first)) return 'ま'
  if ('やゆよ'.includes(first)) return 'や'
  if ('らりるれろ'.includes(first)) return 'ら'
  return 'わ'
}

// ── メインコンポーネント ──────────────────────────────
export default function Home() {
  const router = useRouter()
  const [mode, setMode] = useState<'top' | 'search' | 'list'>('top')
  const [query, setQuery] = useState('')
  const [selectedRow, setSelectedRow] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  // 音声認識の候補
  const voiceCandidates = query.length >= 1
    ? SAMPLE_PATIENTS.filter(p => p.kana.includes(query) || p.name.includes(query))
    : []

  // あいうえお順リスト
  const filteredList = SAMPLE_PATIENTS.filter(p =>
    selectedRow ? getKanaRow(p.kana) === selectedRow : true
  ).sort((a, b) => a.kana.localeCompare(b.kana, 'ja'))

  // 音声認識開始
  function startListening() {
    const SR = window.SpeechRecognition || (window as unknown as { webkitSpeechRecognition: typeof window.SpeechRecognition }).webkitSpeechRecognition
    if (!SR) { alert('音声認識に対応していません'); return }
    const rec = new SR()
    rec.lang = 'ja-JP'
    rec.continuous = false
    rec.interimResults = true
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const text = Array.from(e.results).map((r: SpeechRecognitionResult) => r[0].transcript).join('')
      setQuery(text)
    }
    rec.onend = () => setIsListening(false)
    rec.start()
    recognitionRef.current = rec
    setIsListening(true)
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setIsListening(false)
  }

  function selectPatient(patient: Patient) {
    router.push(`/shinsa/${patient.id}`)
  }

  // ── TOP画面 ──────────────────────────────────────
  if (mode === 'top') {
    return (
      <main className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex flex-col">
        {/* ヘッダー */}
        <div className="text-center pt-10 pb-6 px-4">
          <h1 className="text-3xl font-bold text-amber-800 tracking-wider">富貴氣 診</h1>
          <p className="text-sm text-amber-600 mt-1">中医学診察サポート</p>
        </div>

        {/* メインボタン */}
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6">

          {/* 再診（音声検索） */}
          <button
            onClick={() => setMode('search')}
            className="w-full max-w-sm bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-2xl p-6 shadow-lg transition-all"
          >
            <div className="text-4xl mb-2">🔍</div>
            <div className="text-xl font-bold">再　診</div>
            <div className="text-sm opacity-80 mt-1">患者さんを名前で検索</div>
          </button>

          {/* 初診（新規登録） */}
          <button
            onClick={() => router.push('/patients/new')}
            className="w-full max-w-sm bg-white hover:bg-amber-50 active:scale-95 text-amber-800 border-2 border-amber-300 rounded-2xl p-6 shadow transition-all"
          >
            <div className="text-4xl mb-2">📋</div>
            <div className="text-xl font-bold">初　診</div>
            <div className="text-sm text-amber-600 mt-1">新規患者さんを登録</div>
          </button>

          {/* 一覧から探す */}
          <button
            onClick={() => setMode('list')}
            className="w-full max-w-sm bg-white hover:bg-amber-50 active:scale-95 text-amber-700 border border-amber-200 rounded-2xl p-4 shadow-sm transition-all"
          >
            <div className="text-sm">📂 患者一覧から探す（あいうえお順）</div>
          </button>
        </div>

        {/* 施術者表示 */}
        <div className="text-center pb-8 text-xs text-amber-500">
          施術者：伊関孝一
        </div>
      </main>
    )
  }

  // ── 音声検索画面 ──────────────────────────────────
  if (mode === 'search') {
    return (
      <main className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex flex-col">
        <div className="flex items-center gap-3 px-4 pt-8 pb-4">
          <button onClick={() => { setMode('top'); setQuery('') }} className="text-amber-700 text-2xl">←</button>
          <h2 className="text-lg font-bold text-amber-800">患者さんを検索</h2>
        </div>

        {/* 検索入力 */}
        <div className="px-4 mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="名前・よみがなを入力"
              className="flex-1 border-2 border-amber-200 rounded-xl px-4 py-3 text-gray-800 focus:outline-none focus:border-amber-400"
            />
            <button
              onPointerDown={startListening}
              onPointerUp={stopListening}
              className={`px-4 rounded-xl text-2xl transition-all ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              🎤
            </button>
          </div>
          {isListening && (
            <p className="text-xs text-red-500 mt-1 text-center animate-pulse">🔴 聞いています...</p>
          )}
        </div>

        {/* 候補一覧 */}
        <div className="flex-1 px-4 overflow-y-auto">
          {query.length > 0 && voiceCandidates.length === 0 && (
            <div className="text-center text-gray-400 py-10">
              <p>「{query}」に一致する患者さんが見つかりません</p>
              <button
                onClick={() => setMode('list')}
                className="mt-4 text-amber-600 underline text-sm"
              >
                一覧から探す
              </button>
            </div>
          )}
          <div className="space-y-3">
            {voiceCandidates.map(p => (
              <PatientCard key={p.id} patient={p} onSelect={selectPatient} />
            ))}
          </div>
        </div>
      </main>
    )
  }

  // ── 一覧画面（あいうえお順） ──────────────────────
  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex flex-col">
      <div className="flex items-center gap-3 px-4 pt-8 pb-4">
        <button onClick={() => setMode('top')} className="text-amber-700 text-2xl">←</button>
        <h2 className="text-lg font-bold text-amber-800">患者一覧</h2>
      </div>

      {/* あいうえおタブ */}
      <div className="flex gap-1 px-4 mb-3 overflow-x-auto">
        <button
          onClick={() => setSelectedRow(null)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
            selectedRow === null
              ? 'bg-amber-600 text-white'
              : 'bg-white text-amber-700 border border-amber-200'
          }`}
        >
          全て
        </button>
        {KANA_ROWS.map(row => (
          <button
            key={row}
            onClick={() => setSelectedRow(row)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              selectedRow === row
                ? 'bg-amber-600 text-white'
                : 'bg-white text-amber-700 border border-amber-200'
            }`}
          >
            {row}
          </button>
        ))}
      </div>

      {/* 患者リスト */}
      <div className="flex-1 px-4 overflow-y-auto space-y-3 pb-6">
        {filteredList.map(p => (
          <PatientCard key={p.id} patient={p} onSelect={selectPatient} />
        ))}
      </div>
    </main>
  )
}

// ── 患者カードコンポーネント ──────────────────────────
function PatientCard({ patient, onSelect }: { patient: Patient; onSelect: (p: Patient) => void }) {
  return (
    <button
      onClick={() => onSelect(patient)}
      className="w-full bg-white rounded-2xl p-4 shadow-sm border border-amber-100 hover:border-amber-300 active:scale-98 transition-all text-left flex items-center gap-4"
    >
      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
        patient.gender === '女' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'
      }`}>
        {patient.name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-gray-800">{patient.name}</div>
        <div className="text-xs text-gray-400">{patient.kana}</div>
        <div className="text-xs text-gray-500 mt-0.5">{patient.age}歳 · {patient.gender}性</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs text-gray-400">前回</div>
        <div className="text-xs text-amber-600">{patient.lastVisit || '初診'}</div>
      </div>
    </button>
  )
}
