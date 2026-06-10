export function Terms() {
  return (
    <div style={{
      minHeight: '100dvh', background: '#07070F', color: '#CBD5E1',
      fontFamily: 'system-ui, sans-serif', padding: '48px 20px 80px',
    }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <a href="/" style={{ fontSize: 13, color: '#475569', textDecoration: 'none', display: 'inline-block', marginBottom: 32 }}>← 回首頁</a>

        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#F1F5F9', marginBottom: 8 }}>服務條款</h1>
        <p style={{ fontSize: 13, color: '#475569', marginBottom: 40 }}>最後更新：2026 年 6 月 10 日</p>

        <Section title="1. 服務說明">
          卡拍拍（pipicards.com）是一個集換式卡牌（TCG）市集平台，提供卡牌瀏覽、買賣媒合、套利資訊通知等服務。使用本平台即表示您同意遵守以下條款。
        </Section>

        <Section title="2. 帳號註冊">
          <ul>
            <li>您須提供真實且有效的電子郵件地址</li>
            <li>您有責任妥善保管帳號密碼，不得轉讓或共用帳號</li>
            <li>若發現帳號遭未授權使用，請立即通知我們</li>
            <li>本平台保留拒絕服務、暫停或終止帳號的權利（違規時）</li>
          </ul>
        </Section>

        <Section title="3. 卡牌交易規則">
          <ul>
            <li>本平台為媒合平台，不直接持有商品庫存</li>
            <li>賣家須確保商品描述真實，包含卡牌品相、語言版本等資訊</li>
            <li>買家下單後，賣家應於合理時間內完成出貨</li>
            <li>交易糾紛應由買賣雙方協商解決；本平台得提供協助但不承擔交易損失</li>
            <li>嚴禁販售偽造、盜版卡牌，違者帳號將立即封停</li>
          </ul>
        </Section>

        <Section title="4. 套利通知服務（卡報報）">
          <ul>
            <li>套利資訊係由系統自動比對卡拍拍市場資料與參考價格，僅供參考</li>
            <li>本平台不保證套利機會的即時性、準確性或獲利性</li>
            <li>LINE 通知功能需用戶主動綁定 LINE 帳號，可隨時解除</li>
            <li>推播通知頻率由系統根據市場活動決定，本平台保留調整的權利</li>
          </ul>
        </Section>

        <Section title="5. 禁止行為">
          使用本平台時，您不得：
          <ul>
            <li>進行任何欺詐、洗錢或非法交易活動</li>
            <li>利用爬蟲或自動化程式大量存取本平台（未經授權）</li>
            <li>發布任何違法、侵權、歧視性或惡意內容</li>
            <li>干擾平台正常運作或其他用戶的使用體驗</li>
            <li>試圖破解、繞過或攻擊本平台的安全機制</li>
          </ul>
        </Section>

        <Section title="6. 智慧財產權">
          本平台的商標、設計、程式碼及內容受著作權法保護，未經書面授權不得複製或商業使用。卡牌圖片版權歸屬各原廠（如 Pokémon Company）。
        </Section>

        <Section title="7. 免責聲明">
          <ul>
            <li>本平台以「現況」提供服務，不保證服務不間斷或無誤</li>
            <li>對於因使用本平台或依賴套利資訊所造成的損失，本平台不負賠償責任</li>
            <li>本平台不對第三方連結之內容負責</li>
          </ul>
        </Section>

        <Section title="8. 服務變更與終止">
          本平台保留隨時修改、暫停或終止部分或全部服務的權利，並將提前於平台公告。重大變更將透過電子郵件或 LINE 通知告知已註冊用戶。
        </Section>

        <Section title="9. 準據法">
          本條款依中華民國法律解釋及執行。如有爭議，以臺灣臺北地方法院為第一審管轄法院。
        </Section>

        <Section title="10. 聯絡我們">
          如有任何疑問，請聯絡：<br />
          <span style={{ color: '#60A5FA' }}>contact@pipicards.com</span>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#E2E8F0', marginBottom: 12 }}>{title}</h2>
      <div style={{ fontSize: 14, lineHeight: 1.9, color: '#94A3B8' }}>
        {children}
      </div>
      <style>{`
        div ul { padding-left: 20px; margin: 8px 0; }
        div ul li { margin-bottom: 4px; }
      `}</style>
    </div>
  );
}
