import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 診察結果を保存
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('shinsa_records')
      .insert({
        patient_id: body.patient_id,
        patient_name: body.patient_name,
        patient_age: body.patient_age,
        patient_gender: body.patient_gender,
        transcript: body.transcript,
        ai_mondori: body.ai_mondori,
        ai_tongue: body.ai_tongue,
        ai_bensho: body.ai_bensho,
        ai_chiho: body.ai_chiho,
        ai_keiketu: body.ai_keiketu,
        ai_notes: body.ai_notes,
        tongue_image_url: body.tongue_image_url,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ id: data.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'エラー'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// 鍼灸師の決定を更新
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = await createClient()

    const { error } = await supabase
      .from('shinsa_records')
      .update({
        dr_bensho: body.dr_bensho,
        dr_chiho: body.dr_chiho,
        dr_keiketu: body.dr_keiketu,
        dr_shujutsu: body.dr_shujutsu,
        dr_hyoka: body.dr_hyoka,
        dr_vas: body.dr_vas,
        dr_nrs: body.dr_nrs,
        dr_biko: body.dr_biko,
        dr_shisetssha: body.dr_shisetssha,
      })
      .eq('id', body.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'エラー'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
