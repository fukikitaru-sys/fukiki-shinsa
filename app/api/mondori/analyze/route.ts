import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

export async function POST(request: NextRequest) {
  try {
    const { transcript, chiefComplaint, patientName, patientAge, patientGender } =
      await request.json()

    // 文字起こしが空でも弁証を試みる
    const transcriptText = transcript?.trim() || '（音声記録なし）'

    const prompt = `脈診流取穴法の中医学専門家として、以下の問診記録から弁証してください。

【患者情報】
氏名：${patientName || '不明'}
年齢：${patientAge || '不明'}歳
性別：${patientGender || '不明'}
主訴：${chiefComplaint}

【問診記録（音声文字起こし）】
${transcriptText}

必ず以下のJSON形式のみで返してください：
{"hakko":{"hyouri":"表証/裏証/半表半裏","kannetsu":"寒証/熱証/寒熱錯雑","kyojitsu":"虚証/実証/虚実錯雑","inyo":"陰証/陽証"},"byoin":["病因1","病因2"],"zofu":["関係する臓腑1","臓腑2"],"mondoriMatome":"問診まとめ（箇条書き、\\nで区切る）","finalBensho":"確定した証","benshoKibun":"弁証の根拠（2〜3文）","chiho":"治法","keiketu":[{"name":"経穴名","code":"国際コード","role":"主穴/補穴","reason":"選択根拠","action":["作用1","作用2"]}],"notes":"注意点・申し送り"}`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('弁証の解析失敗')

    const cleanedJson = jsonMatch[0].replace(/:\s*\+(\d+)/g, ': $1')
    return NextResponse.json({ success: true, result: JSON.parse(cleanedJson) })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'エラー'
    console.error('Mondori analyze error:', message)
    // エラーでも transcript は呼び出し元で保存済みなので success:false を返すだけ
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
