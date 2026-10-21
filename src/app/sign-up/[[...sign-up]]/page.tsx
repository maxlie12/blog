import { SignUp } from "@clerk/nextjs";
import { isLearnerAuthConfigured } from "@/lib/learnerAuth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tạo tài khoản học tập" };

export default function SignUpPage() {
  return <main className="auth-page">
    <div className="auth-page__card">
      <p className="eyebrow">LEARNER ACCOUNT</p>
      <h1>Tạo tài khoản học tập</h1>
      <p>Sau khi đăng ký, bạn sẽ chủ động liên kết đúng hồ sơ Luân hoặc Phi.</p>
      {isLearnerAuthConfigured()
        ? <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" fallbackRedirectUrl="/learning" />
        : <p role="status">Đăng ký đang được cấu hình. Dữ liệu hiện tại vẫn an toàn trên thiết bị này.</p>}
    </div>
  </main>;
}
