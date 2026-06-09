import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import type { BenshoSession, QuestionResponse } from '@/lib/bensho/types'

const client = new Anthropic()

export async function POST(request: NextRequest) {
  try {
    const { session, adlibInput }: { session: BenshoSession; adlibInput?: string } =
      await request.json()

    const evidenceSummary = session.evidenceList
      .map(e => `・${e.category}：「${e.answer}」→ ${e.implication}`)
      .join('\n')

    const scoresSummary = session.syndromeScores
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(s => `${s.name}：${s.score}%`)
      .join('、')

    const layerNames: Record<string, string> = {
      hakko: '八綱弁証（表裏・寒熱・虚実・陰陽）',
      byoin: '病因病機（六淫・七情・飲食・労倦）',
      zofu: '臓腑・経絡弁証',
      kiketsu: '気血津液弁証',
      kekka: '帰結弁証（統合・確定）',
    }

    const prompt = `あなたは中医学の専門家（脈診流取穴法の鍼灸師）です。
AI弁証問診システムとして動作してください。

【患者情報】
主訴：${session.chiefComplaint}
患者名：${session.patientName || '不明'}

【現在のレイヤー】
${layerNames[session.currentLayer] || session.currentLayer}

【これまでの根拠】
${evidenceSummary || '（まだ回答なし）'}

【現在の証候スコア】
${scoresSummary || '（未算出）'}

【八綱の現状】
表裏：${session.hakko.hyouri || '未確定'}
寒熱：${session.hakko.kannetsu || '未確定'}
虚実：${session.hakko.kyojitsu || '未確定'}
陰陽：${session.hakko.inyo || '未確定'}

${adlibInput ? `【先生からのアドリブ情報】\n「${adlibInput}」\nこの情報についても深掘りしてください。` : ''}

【判断してください】
1. 現在のレイヤーで弁証の根拠が十分か（確信度70%以上か）
2. 足りない場合は次に何を聞くべきか
3. 十分な場合は次のレイヤーに進むべきか

以下のJSON形式のみで回答してください：
{
  "shouldAdvanceLayer": true/false,
  "nextLayer": "byoin/zofu/kiketsu/kekka/complete（進む場合のみ）",
  "question": {
    "id": "q_${Date.now()}",
    "layer": "${session.currentLayer}",
    "category": "カテゴリ名",
    "text": "質問文（患者に聞く言葉で）",
    "choices": [
      {"id": "a", "label": "選択肢A", "hint": "補足説明"},
      {"id": "b", "label": "選択肢B", "hint": "補足説明"},
      {"id": "c", "label": "選択肢C", "hint": "補足説明"}
    ],
    "allowFreeInput": true,
    "why": "なぜこの質問をするか（鍼灸師・学習者向けの解説）",
    "reference": "参考：中医学基礎理論など"
  },
  "updatedScores": [
    {"name": "証名", "score": 数値, "evidence": ["根拠1", "根拠2"]}
  ],
  "message": "現状の簡単なコメント"
}

進む場合はquestionをnullにしてください。
選択肢は3〜4つ。質問は患者さんに直接聞く自然な言葉で。`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('AI応答の解析失敗')

    const result: QuestionResponse = JSON.parse(jsonMatch[0])
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'エラー'
    console.error('Bensho question error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
