"use client";

import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import {
  getLearnerAccountLink,
  linkActiveProfileToAccount,
  type LearnerAccountLinkResult,
} from "@/lib/localLearningProgress";
import { getLearnerProfile, setActiveLearnerProfile } from "@/lib/learnerProfiles";
import { useLearnerProfile } from "@/lib/useLearnerProfile";
import styles from "./LearnerAccountPanel.module.css";

type State =
  | { status: "loading" }
  | { status: "ready"; link: LearnerAccountLinkResult | null }
  | { status: "error"; message: string };

export function LearnerAccountPanel() {
  const { isLoaded, isSignedIn } = useUser();
  const active = useLearnerProfile();
  const [state, setState] = useState<State>({ status: "loading" });
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let activeRequest = true;
    void getLearnerAccountLink()
      .then((link) => { if (activeRequest) setState({ status: "ready", link }); })
      .catch((error: unknown) => {
        if (activeRequest) setState({ status: "error", message: error instanceof Error ? error.message : "Không thể đọc tài khoản." });
      });
    return () => { activeRequest = false; };
  }, [isLoaded, isSignedIn]);

  async function linkProfile() {
    setLinking(true);
    try {
      const link = await linkActiveProfileToAccount();
      setState({ status: "ready", link });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "Không thể liên kết lúc này." });
    } finally {
      setLinking(false);
    }
  }

  function switchToLinkedProfile(profileId: LearnerAccountLinkResult["learnerProfileId"]) {
    setActiveLearnerProfile(profileId);
    window.location.reload();
  }

  if (!isLoaded) return <section className={styles.panel} aria-busy="true"><p>Đang kiểm tra tài khoản…</p></section>;

  if (!isSignedIn) {
    return <section id="learner-account" className={styles.panel} aria-labelledby="learner-account-title">
      <div>
        <strong id="learner-account-title">Học trên nhiều thiết bị</strong>
        <p>Đăng nhập là tùy chọn. Trước khi liên kết, Done và streak vẫn nằm trong hồ sơ trên thiết bị này.</p>
      </div>
      <div className={styles.actions}>
        <SignInButton mode="modal" fallbackRedirectUrl="/learning"><button type="button" className="button">Đăng nhập</button></SignInButton>
        <SignUpButton mode="modal" fallbackRedirectUrl="/learning"><button type="button" className="button button--ghost">Tạo tài khoản</button></SignUpButton>
      </div>
    </section>;
  }

  const link = state.status === "ready" ? state.link : null;
  const mismatched = link && link.learnerProfileId !== active.id;

  return <section id="learner-account" className={styles.panel} aria-labelledby="learner-account-title">
    <div className={styles.identity}>
      <UserButton />
      <div>
        <strong id="learner-account-title">Tài khoản học tập</strong>
        {state.status === "loading" && <p>Đang đọc hồ sơ đã liên kết…</p>}
        {state.status === "error" && <p role="alert">{state.message}</p>}
        {state.status === "ready" && !link && <p>Chưa liên kết. Hãy kiểm tra đang chọn đúng người trước khi tiếp tục.</p>}
        {state.status === "ready" && link && !mismatched && <p>Đã bảo vệ hồ sơ {active.name}; có thể dùng lại tài khoản này trên thiết bị khác.</p>}
        {mismatched && <p role="alert">Tài khoản thuộc hồ sơ {getLearnerProfile(link.learnerProfileId).name}, không phải {active.name}.</p>}
      </div>
    </div>
    <div className={styles.actions}>
      {state.status === "ready" && !link && <button type="button" className="button" disabled={linking} onClick={linkProfile}>
        {linking ? "Đang liên kết…" : `Liên kết hồ sơ ${active.name}`}
      </button>}
      {mismatched && <button type="button" className="button" onClick={() => switchToLinkedProfile(link.learnerProfileId)}>
        Chuyển sang {getLearnerProfile(link.learnerProfileId).name}
      </button>}
    </div>
  </section>;
}
