import { useState, useEffect } from "react";
import { PersonnelListScreen } from "./PersonnelListScreen.jsx";
import { PersonCard } from "./PersonCard.jsx";
import { DetailScreen } from "../detail/DetailScreen.jsx";

// Faz 7 — Liste → Kişi kartı → (Açık işler'den) mevcut DetailScreen (Faz 4).
// Görev üzerinde yazma aksiyonu YOK burada (StickyActions/QuickActions
// gizli, bkz. DetailScreen canWrite) — Personel rehberi salt görüntüleme,
// kayıt düzenleme zaten kendi modülünde (Talep yönetimi) yapılıyor.
// Kullanıcı teyidiyle: "Mobil Yönetici anasayfasında personellerin listesi
// gelsin... basınca personel detayı gelecek" — Dashboard > PersonnelAccordion
// bir kişiye tıklayınca `initialPerson` ile buraya gelir, o kişi seçili
// açılır; tüketilince (onConsumeInitialPerson) sıradan "Personel" menü
// girişinden gelindiğinde tekrar devreye girmez.
export function PersonnelScreen({ state, currentUser, role, initialPerson, onConsumeInitialPerson }) {
  const [person, setPerson] = useState(initialPerson || null);
  const [detailTask, setDetailTask] = useState(null);

  useEffect(() => {
    if (initialPerson) { setPerson(initialPerson); onConsumeInitialPerson?.(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPerson]);

  if (detailTask) {
    const live = state.tasks.find((tk) => tk.id === detailTask.id) || detailTask;
    return <DetailScreen task={live} canWrite={false} onBack={() => setDetailTask(null)} onEdit={() => {}} onAdvanceStatus={() => {}} onQuickAction={() => {}} />;
  }
  if (person) {
    const live = state.team.find((p) => p.id === person.id) || person;
    return <PersonCard person={live} currentUser={currentUser} viewerRole={role} state={state} onBack={() => setPerson(null)} onOpenTask={setDetailTask} />;
  }
  return <PersonnelListScreen state={state} currentUser={currentUser} viewerRole={role} onOpenPerson={setPerson} />;
}
