import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const image = formData.get('image') as File | null
    if (!image) throw new Error('画像がありません')

    const bytes = await image.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mediaType = image.type as 'image/jpeg' | 'image/png' | 'image/webp'

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: `中医学の専門家として、この舌の写真を分析してください。

以下のJSON形式で返してください：
{
  "tongue_body": {
    "color": "舌体の色（淡紅・淡白・紅・深紅・紫など）",
    "shape": "形態（正常・腫大・瘦薄・歯痕あり・裂紋ありなど）",
    "moisture": "津液（正常・乾燥・湿潤など）"
  },
  "coating": {
    "color": "苔色（白・黄・灰・黒など）",
    "quality": "苔質（薄・厚・滑・膩・乾など）"
  },
  "zone_analysis": {
    "tip": "舌尖（心肺）所見",
    "center": "舌中（脾胃）所見",
    "root": "舌根（腎）所見",
    "sides": "舌辺（肝胆）所見"
  },
  "diagnosis_candidates": [
    {"pattern": "推測される証", "confidence": "高/中/低", "basis": "根拠"}
  ],
  "treatment_directions": ["治法の方向性"],
  "summary": "舌診総合所見（日本語で2〜3文）"
}` }
        ]
      }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('AI応答の解析に失敗しました')
    const result = JSON.parse(jsonMatch[0])

    return NextResponse.json({ result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'エラー'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
