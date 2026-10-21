import { SignIn } from "@clerk/nextjs";
import { isLearnerAuthConfigured } from "@/lib/learnerAuth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Đăng nhập học tập" };

export default function SignInPage() {
  return <main className="auth-page">
    <div className="auth-page__card">
      <p className="eyebrow">LEARNER ACCOUNT</p>
      <h1>Đăng nhập để giữ tiến độ riêng</h1>
      <p>Done, streak và bài nộp vẫn thuộc riêng tài khoản của bạn khi đổi thiết bị.</p>
      {isLearnerAuthConfigured()
        ? <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" fallbackRedirectUrl="/learning" />
        : <p role="status">Đăng nhập đang được cấu hình. Bạn vẫn có thể học và lưu tiến độ trên thiết bị này.</p>}
    </div>
  </main>;
}
