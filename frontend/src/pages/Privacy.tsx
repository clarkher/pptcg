export function Privacy() {
  return (
    <div style={{
      minHeight: '100dvh', background: '#07070F', color: '#CBD5E1',
      fontFamily: 'system-ui, sans-serif', padding: '48px 20px 80px',
    }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <a href="/" style={{ fontSize: 13, color: '#475569', textDecoration: 'none', display: 'inline-block', marginBottom: 32 }}>← 回首頁</a>

        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#F1F5F9', marginBottom: 8 }}>隱私權政策</h1>
        <p style={{ fontSize: 13, color: '#475569', marginBottom: 40 }}>最後更新：2026 年 6 月 10 日</p>

        <Section title="1. 概述">
          卡拍拍（pipicards.com，以下簡稱「本平台」）致力於保護您的個人資料。本隱私權政策說明我們如何收集、使用及保護您的資訊。使用本平台即表示您同意本政策。
        </Section>

        <Section title="2. 收集的資料">
          <b style={{ color: '#94A3B8' }}>帳號資料</b>
          <ul>
            <li>電子郵件地址（Email）</li>
            <li>使用者名稱（Username）</li>
            <li>Google 帳號識別碼（若使用 Google 登入）</li>
            <li>大頭照（由 Google 提供，若有）</li>
          </ul>
          <b style={{ color: '#94A3B8' }}>交易資料</b>
          <ul>
            <li>購買紀錄、訂單狀態</li>
            <li>帳戶餘額（僅限平台點數，非真實貨幣）</li>
          </ul>
          <b style={{ color: '#94A3B8' }}>LINE 帳號資料（選擇性）</b>
          <ul>
            <li>若您選擇綁定 LINE 帳號，我們會儲存您的 LINE 用戶識別碼（LINE UID）</li>
            <li>LINE UID 僅用於推播套利通知，不會與第三方分享</li>
          </ul>
          <b style={{ color: '#94A3B8' }}>技術資料</b>
          <ul>
            <li>瀏覽器 Cookie、Session Token（JWT），用於維持登入狀態</li>
          </ul>
        </Section>

        <Section title="3. 資料使用方式">
          收集的資料僅用於以下目的：
          <ul>
            <li>提供帳號登入與身份驗證</li>
            <li>處理訂單、顯示購買紀錄</li>
            <li>透過 LINE 推播套利機會通知（僅限您主動綁定後）</li>
            <li>平台功能改善（匿名統計）</li>
          </ul>
          我們不會將您的個人資料出售、出租或交換給任何第三方。
        </Section>

        <Section title="4. 第三方服務">
          本平台整合以下第三方服務，各服務有其獨立隱私權政策：
          <ul>
            <li><b style={{ color: '#94A3B8' }}>Google OAuth</b>：用於帳號登入。<a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" style={{ color: '#60A5FA' }}>Google 隱私權政策</a></li>
            <li><b style={{ color: '#94A3B8' }}>LINE Messaging API</b>：用於推播通知。<a href="https://line.me/en/terms/policy/" target="_blank" rel="noreferrer" style={{ color: '#60A5FA' }}>LINE 隱私權政策</a></li>
            <li><b style={{ color: '#94A3B8' }}>Cloudflare R2</b>：圖片儲存服務</li>
          </ul>
        </Section>

        <Section title="5. 資料保存與安全">
          <ul>
            <li>密碼以 bcrypt 雜湊加密儲存，我們無法讀取您的原始密碼</li>
            <li>API 通訊使用 HTTPS 加密傳輸</li>
            <li>資料儲存於 Neon Postgres（新加坡）</li>
            <li>您可隨時在會員頁面解除 LINE 綁定，我們將立即刪除您的 LINE UID</li>
            <li>若您要求刪除帳號，請聯絡我們，我們將於 30 個工作天內處理</li>
          </ul>
        </Section>

        <Section title="6. Cookie">
          本平台使用 JWT Token 儲存於瀏覽器 localStorage，用於維持登入狀態。您可隨時清除瀏覽器資料以登出。
        </Section>

        <Section title="7. 您的權利">
          您有權：
          <ul>
            <li>查詢我們持有的您的個人資料</li>
            <li>更正不正確的資料</li>
            <li>要求刪除您的帳號及相關資料</li>
            <li>隨時解除 LINE 帳號綁定</li>
          </ul>
        </Section>

        <Section title="8. 未成年人">
          本平台服務對象為 13 歲以上用戶。我們不會在知情的情況下收集未成年人的個人資料。
        </Section>

        <Section title="9. 政策變更">
          本政策若有重大變更，我們將在平台公告通知。繼續使用本平台即視為接受更新後的政策。
        </Section>

        <Section title="10. 聯絡我們">
          如有任何隱私相關問題，請聯絡：<br />
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
