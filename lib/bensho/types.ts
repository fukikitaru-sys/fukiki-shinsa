// ── 弁証レイヤー ────────────────────────────────────
export type BenshoLayer =
  | 'hakko'      // 八綱弁証
  | 'byoin'      // 病因病機
  | 'zofu'       // 臓腑/経絡弁証
  | 'kiketsu'    // 気血津液弁証
  | 'kekka'      // 帰結弁証（統合）
  | 'complete'   // 完了

// ── 選択肢の型 ──────────────────────────────────────
export type Choice = {
  id: string
  label: string
  hint?: string          // 選択肢の補足説明
}

// ── 1つの質問 ────────────────────────────────────────
export type Question = {
  id: string
  layer: BenshoLayer
  category: string       // 例：「寒熱」「表裏」「臓腑」
  text: string           // 質問文
  choices?: Choice[]     // 選択肢（nullなら自由入力）
  allowFreeInput?: boolean // 自由入力も許可
  why: string            // なぜこの質問をするか（学習モード）
  reference?: string     // 参考文献
}

// ── 1つの回答と根拠 ─────────────────────────────────
export type Evidence = {
  questionId: string
  question: string
  answer: string
  layer: BenshoLayer
  category: string
  implication: string    // この回答が示唆すること
  score: Record<string, number> // 各証への影響スコア
}

// ── 証候スコア ───────────────────────────────────────
export type SyndromeScore = {
  name: string           // 例：「腎陽虚」
  score: number          // 0〜100
  evidence: string[]     // 根拠リスト
}

// ── 八綱の状態 ──────────────────────────────────────
export type Hakko = {
  hyouri?: '表証' | '裏証' | '半表半裏'
  kannetsu?: '寒証' | '熱証' | '寒熱錯雑'
  kyojitsu?: '虚証' | '実証' | '虚実錯雑'
  inyo?: '陰証' | '陽証'
  confidence: Record<string, number>
}

// ── セッション全体 ───────────────────────────────────
export type BenshoSession = {
  id: string
  createdAt: string
  patientName?: string
  chiefComplaint: string           // 主訴

  // 現在の状態
  currentLayer: BenshoLayer
  questionHistory: Question[]      // 出題した質問
  evidenceList: Evidence[]         // 積み上げた根拠
  syndromeScores: SyndromeScore[]  // 証候スコア

  // 各レイヤーの結果
  hakko: Hakko
  byoin: string[]                  // 病因（例：「七情」「外感風寒」）
  zofu: string[]                   // 関係する臓腑
  keiraku: string[]                // 関係する経絡
  kiketsuType: string[]            // 気血津液の状態

  // アドリブ入力
  adlibInputs: string[]

  // 最終結果
  finalBensho?: string             // 確定した証
  chiho?: string                   // 治法
  keiketu?: Keiketu[]              // 経穴

  // モード
  learningMode: boolean
}

// ── 経穴 ────────────────────────────────────────────
export type Keiketu = {
  name: string           // 例：「太衝」
  code: string           // 例：「LR3」
  keiraku: string        // 経絡名
  role: '主穴' | '補穴' | '随証穴'
  reason: string         // なぜ選んだか
  action: string[]       // 作用（例：「疏肝理気」）
  comparison?: string    // 類似穴との比較
  reference?: string     // 参考文献
}

// ── AIへの送信データ ─────────────────────────────────
export type QuestionRequest = {
  session: BenshoSession
  adlibInput?: string    // アドリブ入力
}

// ── AIからの返答 ─────────────────────────────────────
export type QuestionResponse = {
  question?: Question           // 次の質問（nullなら次レイヤーへ）
  shouldAdvanceLayer: boolean   // 次レイヤーに進むべきか
  nextLayer?: BenshoLayer       // 次のレイヤー
  updatedScores: SyndromeScore[] // 更新されたスコア
  message?: string              // AIからのコメント
}
