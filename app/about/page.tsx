export const metadata = {
  title: "عن رسوم باي | RusoomPay",
  description:
    "RusoomPay هي منصة إدارة الرسوم المدرسية، وهي خدمة تقدمها شركة بروق العين للتجارة، سلطنة عمان.",
};

export default function AboutPage() {
  return (
    <div
      dir="rtl"
      style={{
        fontFamily: "'Cairo', sans-serif",
        background: "#0A1D33",
        color: "#f5f7fa",
        minHeight: "100vh",
        lineHeight: 1.9,
      }}
    >
      <div
        style={{
          maxWidth: "760px",
          margin: "0 auto",
          padding: "64px 24px 80px",
        }}
      >
        <header style={{ textAlign: "center", marginBottom: "56px" }}>
          <div
            style={{
              fontSize: "30px",
              fontWeight: 800,
              color: "#C9A227",
              letterSpacing: "-0.5px",
            }}
          >
            Rusoom<span style={{ color: "#fff" }}>Pay</span>
          </div>
          <div style={{ color: "#8fa3bf", marginTop: "8px", fontSize: "15px" }}>
            منصة إدارة الرسوم المدرسية | سلطنة عُمان
          </div>
        </header>

        <div
          style={{
            background: "#12294a",
            border: "1px solid rgba(201, 162, 39, 0.25)",
            borderRadius: "16px",
            padding: "36px 32px",
            marginBottom: "28px",
          }}
        >
          <h1
            style={{
              fontSize: "24px",
              fontWeight: 800,
              color: "#fff",
              marginBottom: "18px",
              borderRight: "4px solid #C9A227",
              paddingRight: "14px",
            }}
          >
            عن رسوم باي (RusoomPay)
          </h1>
          <p style={{ color: "#d7e0ec", fontSize: "15.5px", marginBottom: "12px" }}>
            رسوم باي (RusoomPay) هي منصة إلكترونية متخصصة في إدارة الرسوم الدراسية والعمليات
            الإدارية والمالية للمدارس الخاصة في سلطنة عُمان ودول مجلس التعاون الخليجي، تتيح
            للمدارس وأولياء الأمور متابعة المدفوعات والاشتراكات بسهولة وشفافية عبر منصة رقمية
            موحدة.
          </p>

          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#C9A227", margin: "28px 0 12px" }}>
            الجهة المالكة والمشغّلة
          </h2>
          <p style={{ color: "#d7e0ec", fontSize: "15.5px", marginBottom: "12px" }}>
            يتم تشغيل وإدارة منصة RusoomPay رسميًا من قِبل شركة بروق العين للتجارة، المسجلة
            رسميًا في سلطنة عُمان.
          </p>

          <div
            style={{
              background: "rgba(201, 162, 39, 0.08)",
              border: "1px dashed rgba(201, 162, 39, 0.4)",
              borderRadius: "12px",
              padding: "20px 22px",
              marginTop: "20px",
            }}
          >
            {[
              ["الاسم التجاري", "RusoomPay — رسوم باي"],
              ["الاسم القانوني المسجّل", "بروق العين للتجارة"],
              ["Legal Registered Name", "Berouq Al Ain Trading"],
              ["النوع القانوني", "مؤسسة فردية (Sole Proprietor Company)"],
              ["رقم السجل التجاري", "1050695"],
              ["الموقع", "نزوى، محافظة الداخلية، سلطنة عُمان"],
            ].map(([label, value], i, arr) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "6px",
                  padding: "10px 0",
                  borderBottom:
                    i === arr.length - 1 ? "none" : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <span style={{ color: "#8fa3bf", fontSize: "13.5px", fontWeight: 600 }}>
                  {label}
                </span>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: "15px" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            background: "#12294a",
            border: "1px solid rgba(201, 162, 39, 0.25)",
            borderRadius: "16px",
            padding: "36px 32px",
            marginBottom: "28px",
          }}
        >
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#C9A227", marginTop: 0 }}>
            التواصل الرسمي
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                background: "rgba(255,255,255,0.03)",
                borderRadius: "10px",
                padding: "12px 16px",
              }}
            >
              <span>الموقع الإلكتروني</span>
              <a href="https://rusoompay.com" style={{ color: "#C9A227", fontWeight: 600 }}>
                rusoompay.com
              </a>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                background: "rgba(255,255,255,0.03)",
                borderRadius: "10px",
                padding: "12px 16px",
              }}
            >
              <span>البريد الإلكتروني</span>
              <a href="mailto:info@rusoompay.com" style={{ color: "#C9A227", fontWeight: 600 }}>
                info@rusoompay.com
              </a>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                background: "rgba(255,255,255,0.03)",
                borderRadius: "10px",
                padding: "12px 16px",
              }}
            >
              <span>واتساب الأعمال</span>
              <span style={{ color: "#fff", fontWeight: 700 }}>+968 9581 0259</span>
            </div>
          </div>
        </div>

        <footer style={{ textAlign: "center", color: "#8fa3bf", fontSize: "13px", marginTop: "40px" }}>
          © 2026 RusoomPay — خدمة مقدمة من شركة بروق العين للتجارة. جميع الحقوق محفوظة.
        </footer>
      </div>
    </div>
  );
}
