import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import type { BenshoSession, Evidence } from '@/lib/bensho/types'

const client = new Anthropic()

export async function POST(request: NextRequest) {
  try {
    const { session, questionId, questionText, questionCategory, questionLayer, answer }:
      { session: BenshoSession; questionId: string; questionText: string;
        questionCategory: string; questionLayer: string; answer: string } =
      await request.json()

    // この回答が弁証に何を示唆するか解析
    const prompt = `中医学の専門家として、以下の問診回答を解析してください。

主訴：${session.chiefComplaint}
カテゴリ：${questionCategory}
質問：${questionText}
回答：${answer}

現在の証候スコア：
${session.syndromeScores.map(s => `${s.name}：${s.score}%`).join('、') || 'なし'}

以下のJSON形式のみで返してください：
{
  "implication": "この回答が中医学的に示唆すること（1〜2文）",
  "scoreUpdates": [
    {"name": "証名", "delta": スコア変化量（-20〜+30）, "reason": "理由"}
  ],
  "hakkoUpdate": {
    "hyouri": "表証/裏証/半表半裏/null",
    "kannetsu": "寒証/熱証/寒熱錯雑/null",
    "kyojitsu": "虚証/実証/虚実錯雑/null",
    "inyo": "陰証/陽証/null"
  }
}`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })
    // +12 のような不正JSONを修正


    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('解析失敗')

    // +12 のような不正なJSON数値を修正
    const cleanedJson = jsonMatch[0].replace(/:\s*\+(\d+)/g, ': $1')
    const analysis = JSON.parse(cleanedJson)

    // Evidenceオブジェクトを生成
    const evidence: Evidence = {
      questionId,
      question: questionText,
      answer,
      layer: questionLayer as Evidence['layer'],
      category: questionCategory,
      implication: analysis.implication || '',
      score: {},
    }

    return NextResponse.json({ evidence, analysis })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'エラー'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
