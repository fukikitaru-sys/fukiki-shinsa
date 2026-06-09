import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 一覧取得
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      // 1件取得
      const { data, error } = await supabase
        .from('shinsa_records')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return NextResponse.json(data)
    }

    // 一覧取得
    const patientId = searchParams.get('patient_id')
    let query = supabase
      .from('shinsa_records')
      .select('id, patient_name, patient_id, shinsa_date, ai_bensho, dr_bensho, created_at')
      .order('created_at', { ascending: false })

    if (patientId) query = query.eq('patient_id', patientId)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'エラー'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
