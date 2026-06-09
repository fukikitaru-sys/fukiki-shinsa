import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import type { BenshoSession } from '@/lib/bensho/types'

const client = new Anthropic()

export async function POST(request: NextRequest) {
  try {
    const { session }: { session: BenshoSession } = await request.json()

    const evidenceSummary = session.evidenceList
      .map(e => `【${e.category}】「${e.answer}」→ ${e.implication}`)
      .join('\n')

    const prompt = `あなたは脈診流取穴法の中医学専門家です。
以下の問診結果をもとに、帰結弁証を行い経穴を選択してください。

【主訴】${session.chiefComplaint}

【八綱弁証】
表裏：${session.hakko.hyouri || '不明'}
寒熱：${session.hakko.kannetsu || '不明'}
虚実：${session.hakko.kyojitsu || '不明'}
陰陽：${session.hakko.inyo || '不明'}

【積み上げた根拠】
${evidenceSummary}

【証候スコア上位】
${session.syndromeScores.sort((a, b) => b.score - a.score).slice(0, 5)
  .map(s => `${s.name}：${s.score}%`).join('\n')}

以下のJSON形式のみで返してください：
{
  "finalBensho": "確定した証（例：肝気鬱結兼脾気虚）",
  "benshoKibun": "弁証の根拠まとめ（2〜3文）",
  "chiho": "治法（例：疏肝理気・健脾益気）",
  "chihoReason": "治法の根拠",
  "keiketu": [
    {
      "name": "経穴名",
      "code": "国際コード（例：LR3）",
      "keiraku": "経絡名",
      "role": "主穴/補穴/随証穴",
      "reason": "この経穴を選んだ根拠（証との関係）",
      "action": ["作用1", "作用2"],
      "comparison": "類似穴との比較（例：行間と比べ太衝は〜）",
      "reference": "参考文献"
    }
  ],
  "notes": "施術上の注意点・次回への申し送り",
  "learningPoints": [
    "学習ポイント1（この症例から学べること）",
    "学習ポイント2"
  ]
}`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('最終弁証の解析失敗')

    return NextResponse.json(JSON.parse(jsonMatch[0]))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'エラー'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
