"use client";

import {
  LEARNER_PROFILES,
  setActiveLearnerProfile,
} from "@/lib/learnerProfiles";
import { useLearnerProfile } from "@/lib/useLearnerProfile";
import styles from "./LearnerProfileSwitcher.module.css";

export function LearnerProfileSwitcher() {
  const active = useLearnerProfile();

  function selectProfile(id: (typeof LEARNER_PROFILES)[number]["id"]) {
    if (id === active.id) return;
    setActiveLearnerProfile(id);
    window.location.reload();
  }

  return <section id="learner-profile" className={styles.switcher} aria-labelledby="learner-profile-title">
    <div className={styles.heading}>
      <strong id="learner-profile-title">Ai đang học?</strong>
      <span>Chọn trước khi mở bài. Mỗi người có draft, Done, streak và nông trại riêng.</span>
    </div>
    <div className={styles.options} role="group" aria-label="Chọn hồ sơ người học">
      {LEARNER_PROFILES.map((profile) => <button
        key={profile.id}
        type="button"
        className={styles.option}
        aria-pressed={active.id === profile.id}
        onClick={() => selectProfile(profile.id)}
      >
        <span className={styles.avatar} aria-hidden="true">{profile.name.slice(0, 1)}</span>
        <span className={styles.copy}><strong>{profile.name}</strong><small>{profile.role} · {profile.focus}</small></span>
      </button>)}
    </div>
    <p className={styles.note}>Đây là tách dữ liệu trên thiết bị, chưa phải đăng nhập bảo mật. Dùng browser profile riêng nếu không muốn người khác chuyển qua lại.</p>
  </section>;
}
