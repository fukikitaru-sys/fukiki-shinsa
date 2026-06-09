export default function ShinshinForm() {
  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 15mm; }
          body { font-family: 'MS Mincho', 'Yu Mincho', serif; }
          .no-print { display: none !important; }
        }
        body { font-family: 'MS Mincho', 'Yu Mincho', serif; }
        .field-line {
          border-bottom: 1px solid #333;
          min-height: 24px;
          display: inline-block;
        }
        table { border-collapse: collapse; width: 100%; }
        td, th { border: 1px solid #333; padding: 4px 8px; }
      `}</style>

      {/* 印刷ボタン */}
      <div className="no-print flex gap-3 p-4 bg-gray-100">
        <button
          onClick={() => window.print()}
          className="bg-amber-600 text-white px-6 py-2 rounded-xl font-bold"
        >
          🖨️ 印刷する
        </button>
        <span className="text-sm text-gray-500 self-center">A4サイズで印刷してください</span>
      </div>

      {/* 用紙本体 */}
      <div className="max-w-3xl mx-auto p-8 bg-white" style={{ minHeight: '297mm' }}>

        {/* タイトル */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-widest" style={{ letterSpacing: '0.3em' }}>
            鍼　灸　カ　ル　テ
          </h1>
          <div className="flex justify-end mt-1 gap-4 text-sm">
            <span>自費 ・ 保険 ・ 鍼柔</span>
          </div>
        </div>

        {/* カルテNo・初診日 */}
        <table className="mb-4">
          <tbody>
            <tr>
              <td className="w-1/4 font-bold bg-gray-50">カルテ No.</td>
              <td className="w-1/4"></td>
              <td className="w-1/4 font-bold bg-gray-50">初　診　日</td>
              <td className="w-1/4">
                <div className="flex items-center gap-1 text-sm">
                  <span className="field-line w-8"></span>年
                  <span className="field-line w-6"></span>月
                  <span className="field-line w-6"></span>日
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* 氏名 */}
        <table className="mb-4">
          <tbody>
            <tr>
              <td className="w-1/6 font-bold bg-gray-50" rowSpan={2}>氏　名</td>
              <td className="text-xs text-gray-500 border-b border-gray-300 pb-1">フリガナ</td>
            </tr>
            <tr>
              <td className="pt-2 pb-3 text-lg"></td>
            </tr>
          </tbody>
        </table>

        {/* 生年月日・性別 */}
        <table className="mb-4">
          <tbody>
            <tr>
              <td className="w-1/6 font-bold bg-gray-50">生年月日<br/>年　齢</td>
              <td>
                <div className="text-sm space-y-1">
                  <div>西暦・大正・昭和・平成・令和
                    <span className="field-line w-8 mx-2"></span>年
                    <span className="field-line w-6 mx-1"></span>月
                    <span className="field-line w-6 mx-1"></span>日
                    （　　歳）
                  </div>
                </div>
              </td>
              <td className="w-1/6 font-bold bg-gray-50">性　別</td>
              <td className="w-1/6">男　・　女</td>
            </tr>
          </tbody>
        </table>

        {/* 住所 */}
        <table className="mb-4">
          <tbody>
            <tr>
              <td className="w-1/6 font-bold bg-gray-50" rowSpan={2}>住　所</td>
              <td>
                <div className="text-sm">
                  〒<span className="field-line w-16 mx-1"></span>－<span className="field-line w-20 ml-1"></span>
                </div>
              </td>
              <td className="w-1/6 font-bold bg-gray-50">自宅 ☎</td>
              <td className="w-1/4">
                <span className="field-line w-full block"></span>
              </td>
            </tr>
            <tr>
              <td className="pb-2">
                <span className="field-line w-full block mt-2" style={{ minWidth: '300px' }}></span>
              </td>
              <td className="font-bold bg-gray-50">携帯 ☎</td>
              <td>
                <span className="field-line w-full block"></span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* 緊急連絡先 */}
        <table className="mb-4">
          <tbody>
            <tr>
              <td className="w-1/6 font-bold bg-gray-50" rowSpan={3}>緊急<br/>連絡先</td>
              <td className="w-1/6 text-sm bg-gray-50">氏　名</td>
              <td className="w-1/3">
                <span className="field-line w-full block"></span>
              </td>
              <td className="w-1/6 font-bold bg-gray-50">自宅 ☎</td>
              <td className="w-1/4">
                <span className="field-line w-full block"></span>
              </td>
            </tr>
            <tr>
              <td className="text-sm bg-gray-50">続　柄</td>
              <td>（　　　　　　　）</td>
              <td className="font-bold bg-gray-50">携帯 ☎</td>
              <td>
                <span className="field-line w-full block"></span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* 交通手段 */}
        <table className="mb-4">
          <tbody>
            <tr>
              <td className="w-1/6 font-bold bg-gray-50">交通手段</td>
              <td>
                <div className="text-sm">
                  当院までの所要時間：
                  <span className="field-line w-12 mx-1"></span>分
                </div>
                <div className="text-sm mt-1">
                  徒歩　・　自転車　・　自家用車　・　バス　・　その他（　　　　　　）
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* 保険証 */}
        <table className="mb-4">
          <tbody>
            <tr>
              <td className="w-1/6 font-bold bg-gray-50" rowSpan={2}>保険証</td>
              <td className="w-1/6 text-sm bg-gray-50">保険者名称</td>
              <td className="w-1/3">
                <span className="field-line w-full block"></span>
              </td>
              <td className="w-1/6 text-sm bg-gray-50">保険者番号</td>
              <td className="w-1/6">
                <span className="field-line w-full block"></span>
              </td>
            </tr>
            <tr>
              <td className="text-sm bg-gray-50">記　号</td>
              <td><span className="field-line w-full block"></span></td>
              <td className="text-sm bg-gray-50">番　号</td>
              <td><span className="field-line w-full block"></span></td>
            </tr>
          </tbody>
        </table>

        {/* 主訴・来院の目的 */}
        <table className="mb-4">
          <tbody>
            <tr>
              <td className="w-1/6 font-bold bg-gray-50">主訴・<br/>来院目的</td>
              <td style={{ height: '60px' }}></td>
            </tr>
          </tbody>
        </table>

        {/* 現在の健康状態 */}
        <table className="mb-4">
          <tbody>
            <tr>
              <td className="w-1/6 font-bold bg-gray-50">現在の<br/>健康状態</td>
              <td>
                <div className="text-sm grid grid-cols-3 gap-x-4">
                  {[
                    '高血圧', '低血圧', '糖尿病',
                    '心臓病', '肝臓病', '腎臓病',
                    'アレルギー', '骨粗鬆症', 'その他'
                  ].map(item => (
                    <label key={item} className="flex items-center gap-1 my-0.5">
                      <span className="w-4 h-4 border border-gray-400 inline-block shrink-0"></span>
                      {item}
                    </label>
                  ))}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* 服薬・アレルギー */}
        <table className="mb-4">
          <tbody>
            <tr>
              <td className="w-1/6 font-bold bg-gray-50">服薬中の<br/>お薬</td>
              <td style={{ height: '40px' }}>
                <span className="field-line w-full block mt-2"></span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* 備考 */}
        <table className="mb-6">
          <tbody>
            <tr>
              <td className="w-1/6 font-bold bg-gray-50">備　考</td>
              <td style={{ height: '60px' }}></td>
            </tr>
          </tbody>
        </table>

        {/* 同意文・署名 */}
        <div className="border border-gray-400 p-4 mb-6 text-sm">
          <p className="font-bold mb-2">【個人情報の取り扱いについて】</p>
          <p className="leading-relaxed text-xs">
            ご記入いただいた個人情報は、診療・施術の目的にのみ使用し、
            第三者への提供は法令に基づく場合を除き行いません。
            同意いただける場合は、下記にご署名ください。
          </p>
          <div className="flex items-end justify-end mt-4 gap-4">
            <span className="text-sm">年　　月　　日</span>
            <span className="text-sm">署名：</span>
            <span className="field-line w-48"></span>
          </div>
        </div>

        {/* フッター */}
        <div className="text-center text-xs text-gray-400 mt-8">
          伊関鍼灸院・接骨院　廿日市市地御前1-24-21
        </div>

      </div>
    </>
  )
}
