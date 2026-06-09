import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audio = formData.get('audio') as File | null
    const patientName = formData.get('patient_name') as string || ''
    const patientAge = formData.get('patient_age') as string || ''
    const patientGender = formData.get('patient_gender') as string || ''
    const tongueResult = formData.get('tongue_result') as string || ''

    // ── 音声文字起こし（OpenAI Whisper） ──
    let transcript = ''
    if (audio && audio.size > 0) {
      const OpenAI = (await import('openai')).default
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      const transcription = await openai.audio.transcriptions.create({
        file: audio,
        model: 'whisper-1',
        language: 'ja',
      })
      transcript = transcription.text
    }

    // ── 舌診情報を整形 ──
    let tongueText = ''
    if (tongueResult) {
      try {
        const t = JSON.parse(tongueResult)
        tongueText = `
【舌診所見】
舌体色：${t.tongue_body?.color || ''}
舌体形態：${t.tongue_body?.shape || ''}
津液：${t.tongue_body?.moisture || ''}
舌苔色：${t.coating?.color || ''}
舌苔質：${t.coating?.quality || ''}
推測される証：${t.diagnosis_candidates?.map((d: { pattern: string }) => d.pattern).join('、') || ''}
治法方向性：${t.treatment_directions?.join('、') || ''}
        `.trim()
      } catch {
        tongueText = tongueResult
      }
    }

    // ── Claude AI で弁証 ──
    const prompt = `あなたは中医学の専門家（脈診流取穴法の鍼灸師）です。
以下の診察情報をもとに、臓腑弁証を行ってください。

【患者情報】
氏名：${patientName}
年齢：${patientAge}歳
性別：${patientGender}性

【音声文字起こし（診察中の会話）】
${transcript || '（録音なし）'}

${tongueText}

必ず以下のJSON形式のみで回答してください。前置きや説明文は一切不要です。JSONのみ返してください：
{"mondori":"問診まとめ（寒熱・汗・疼痛・睡眠・飲食・二便などを箇条書き）","tongue":"舌診所見まとめ","bensho":"病態把握・弁証と根拠を詳しく","chiho":"治法の方向性","keiketu":"参考経穴とその理由","notes":"注意点・次回申し送り"}

各値はやさしく丁寧な日本語で、根拠を明確に記載してください。`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    // JSONを抽出（複数パターンで試みる）
    let result
    try {
      // パターン1: ```json ... ``` ブロック
      const codeBlock = text.match(/```json\s*([\s\S]*?)```/)
      if (codeBlock) {
        result = JSON.parse(codeBlock[1].trim())
      } else {
        // パターン2: { ... } を抽出
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0])
        } else {
          // パターン3: JSONが取れない場合はテキストをそのまま弁証に入れる
          result = {
            mondori: transcript || '（録音なし）',
            tongue: tongueText || '',
            bensho: text,
            chiho: '',
            keiketu: '',
            notes: ''
          }
        }
      }
    } catch {
      // JSONパースエラー時もテキストを活用
      result = {
        mondori: transcript || '（録音なし）',
        tongue: tongueText || '',
        bensho: text.substring(0, 500),
        chiho: '',
        keiketu: '',
        notes: 'AI応答の解析中にエラーが発生しました。内容を確認してください。'
      }
    }

    return NextResponse.json({ result, transcript })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'エラーが発生しました'
    console.error('Analyze error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
