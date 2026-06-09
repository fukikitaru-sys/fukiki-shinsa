import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

export async function POST(request: NextRequest) {
  try {
    const { transcript } = await request.json()

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `あなたは中医学の問診ガイドAIです。
以下の診察会話から、十問歌（寒熱・汗・頭身・大便・小便・飲食・胸腹・耳・口渇・既往）に基づいて
まだ確認できていない重要な問診項目を提案してください。

【診察会話】
${transcript || '（まだ会話なし）'}

以下のJSON形式で返してください：
{
  "collected": ["確認済みの項目"],
  "questions": [
    {
      "category": "カテゴリ名（寒熱/汗/頭身/飲食/大便/小便/睡眠/胸腹/既往歴/月経など）",
      "question": "具体的な質問文",
      "reason": "なぜ今聞くべきか（短く）",
      "priority": "high または normal"
    }
  ]
}

次に聞くべき質問を優先度順に最大5つ提案してください。`
      }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('解析失敗')
    return NextResponse.json(JSON.parse(jsonMatch[0]))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'エラー'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
