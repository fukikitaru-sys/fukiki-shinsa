// ── 問診項目：大項目 + 中項目 ─────────────────────────

export type MondoriItem = {
  id: string
  major: string      // 大項目
  color: string      // 色クラス
  items: string[]    // 中項目
}

export const MONDORI_ITEMS: MondoriItem[] = [
  {
    id: 'kannetsu',
    major: '寒熱',
    color: 'border-orange-300 bg-orange-50',
    items: ['悪寒・発熱', '四肢の冷え', '寒暑の好み', '冷えの部位'],
  },
  {
    id: 'kan',
    major: '汗',
    color: 'border-blue-300 bg-blue-50',
    items: ['自汗・盗汗', '汗の量', '汗をかく場所', '運動時の汗'],
  },
  {
    id: 'inshoku',
    major: '飲食',
    color: 'border-green-300 bg-green-50',
    items: ['食欲・食量', '口渇・飲水量', '口の味', '食後の症状'],
  },
  {
    id: 'suimin',
    major: '睡眠',
    color: 'border-indigo-300 bg-indigo-50',
    items: ['寝つき', '中途覚醒', '夢の多少', '起床時の状態'],
  },
  {
    id: 'daiben',
    major: '大便',
    color: 'border-amber-300 bg-amber-50',
    items: ['回数・規則性', '便秘・下痢', '便の性状・色', '残便感'],
  },
  {
    id: 'shouben',
    major: '小便',
    color: 'border-yellow-300 bg-yellow-50',
    items: ['回数・量', '色・臭い', '夜間尿', '排尿時の違和感'],
  },
  {
    id: 'tsuutsuu',
    major: '疼痛',
    color: 'border-red-300 bg-red-50',
    items: ['部位', '性質（刺痛・鈍痛・引きつり）', '増悪・緩解条件', '時間帯'],
  },
  {
    id: 'toushin',
    major: '頭身',
    color: 'border-purple-300 bg-purple-50',
    items: ['頭痛・頭重', 'めまい', '身体の重だるさ', '疲れやすさ'],
  },
  {
    id: 'kyouku',
    major: '胸腹',
    color: 'border-pink-300 bg-pink-50',
    items: ['胸苦満・動悸', '腹痛・腹脹', 'げっぷ・嘔気', '脇の張り'],
  },
  {
    id: 'kikan',
    major: '既往歴・服薬',
    color: 'border-stone-300 bg-stone-50',
    items: ['大きな病気', '手術歴', '現在の服薬', 'アレルギー'],
  },
  {
    id: 'jyosei',
    major: '女性（該当時）',
    color: 'border-rose-300 bg-rose-50',
    items: ['月経周期', '経血の量・色', '月経痛', '閉経・更年期'],
  },
  {
    id: 'byoin',
    major: '病因',
    color: 'border-teal-300 bg-teal-50',
    items: ['外感（風寒・風熱）', '七情（ストレス・怒り）', '飲食不節', '過労・過房'],
  },
]

// 主訴に応じた優先表示順を返す
export function getPriorityItems(chiefComplaint: string): string[] {
  const map: Record<string, string[]> = {
    '腰痛':    ['kannetsu', 'tsuutsuu', 'shouben', 'daiben', 'byoin'],
    '肩こり':  ['kannetsu', 'toushin', 'suimin', 'kan', 'byoin'],
    '頭痛':    ['kannetsu', 'toushin', 'suimin', 'inshoku', 'byoin'],
    '冷え':    ['kannetsu', 'kan', 'inshoku', 'daiben', 'byoin'],
    '不眠':    ['suimin', 'kyouku', 'toushin', 'byoin', 'kannetsu'],
    '疲労感':  ['inshoku', 'suimin', 'daiben', 'kannetsu', 'byoin'],
    '動悸':    ['kyouku', 'suimin', 'kan', 'byoin', 'kannetsu'],
    '便秘':    ['daiben', 'inshoku', 'kannetsu', 'byoin', 'kyouku'],
    '下痢':    ['daiben', 'inshoku', 'kannetsu', 'byoin', 'kyouku'],
    'めまい':  ['toushin', 'suimin', 'inshoku', 'byoin', 'kannetsu'],
    '食欲不振':['inshoku', 'daiben', 'kyouku', 'byoin', 'kannetsu'],
    '膝痛':    ['tsuutsuu', 'kannetsu', 'shouben', 'byoin', 'daiben'],
  }

  for (const [key, priority] of Object.entries(map)) {
    if (chiefComplaint.includes(key)) return priority
  }
  // デフォルト：十問歌順
  return ['kannetsu', 'kan', 'inshoku', 'suimin', 'daiben', 'shouben', 'tsuutsuu', 'toushin', 'kyouku', 'byoin']
}
