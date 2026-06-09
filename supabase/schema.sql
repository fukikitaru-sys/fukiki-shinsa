-- 診察記録テーブル
create table if not exists shinsa_records (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- 患者情報
  patient_id text not null,
  patient_name text not null,
  patient_age int,
  patient_gender text,
  shinsa_date date default current_date,

  -- 音声文字起こし
  transcript text,

  -- AI分析結果
  ai_mondori text,
  ai_tongue text,
  ai_bensho text,
  ai_chiho text,
  ai_keiketu text,
  ai_notes text,

  -- 舌診写真URL
  tongue_image_url text,

  -- 鍼灸師の決定（PCで記入）
  dr_bensho text,
  dr_chiho text,
  dr_keiketu text,
  dr_shujutsu text,
  dr_hyoka text,
  dr_vas text,
  dr_nrs text,
  dr_biko text,
  dr_shisetssha text
);

-- updated_at自動更新
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger shinsa_records_updated_at
  before update on shinsa_records
  for each row execute function update_updated_at();
