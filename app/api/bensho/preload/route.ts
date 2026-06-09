import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import type { BenshoSession } from '@/lib/bensho/types'

const client = new Anthropic()

// 3〜4問先読みして返す
export async function POST(request: NextRequest) {
  try {
    const { session }: { session: BenshoSession } = await request.json()

    const evidenceSummary = session.evidenceList
      .map(e => `・${e.category}：「${e.answer}」`)
      .join('\n') || '（まだなし）'

    const prompt = `中医学専門家として、以下の状況で次に必要な質問を3〜4問先読みしてください。

主訴：${session.chiefComplaint}
現在のレイヤー：${session.currentLayer}
収集済みの情報：
${evidenceSummary}

まだ確認できていない重要な項目を優先度順に3〜4問、樹形図形式で予測してください。
回答によって不要になる質問は省き、必要になる質問を追加します。

以下のJSON形式のみで返してください：
{
  "upcomingQuestions": [
    {
      "id": "pre_1",
      "layer": "${session.currentLayer}",
      "category": "カテゴリ",
      "text": "質問文（患者に直接話しかける言葉）",
      "voiceText": "音声読み上げ用の自然な文（です・ます調）",
      "choices": [
        {"id": "a", "label": "選択肢A", "hint": ""},
        {"id": "b", "label": "選択肢B", "hint": ""},
        {"id": "c", "label": "選択肢C", "hint": ""}
      ],
      "allowFreeInput": true,
      "why": "なぜこの質問をするか",
      "priority": 1,
      "dependsOn": null
    }
  ]
}`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('先読み失敗')

    const cleanedJson = jsonMatch[0].replace(/:\s*\+(\d+)/g, ': $1')
    return NextResponse.json(JSON.parse(cleanedJson))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'エラー'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
