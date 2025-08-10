"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Pencil, Share2, Trash2, FileSpreadsheet, X, Check } from "lucide-react";

type SlideItem = {
  id: string;
  title: string;
  createdAt: number;
  courseId?: string;
  subjectId?: string;
  subjectName?: string;
  topic?: string;
  slideCount?: number;
  ownerId?: string;
  ownerUsername?: string;
  shared?: boolean;
};

const BASE_KEY = "smart-student-slides";
const getKey = (username?: string | null) => (username ? `${BASE_KEY}_${String(username).toLowerCase()}` : BASE_KEY);

export default function SlidesPage() {
  const { user } = useAuth();
  const { translate } = useLanguage();
  const [items, setItems] = useState<SlideItem[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [draft, setDraft] = useState<any>({ slideCount: 10 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [assignedCourses, setAssignedCourses] = useState<any[]>([]);
  const [assignedSubjectsByCourse, setAssignedSubjectsByCourse] = useState<Record<string, Array<{ id: string; name: string }>>>({});

  useEffect(() => {
    try {
      setCourses(JSON.parse(localStorage.getItem('smart-student-courses') || '[]'));
      setSubjects(JSON.parse(localStorage.getItem('smart-student-subjects') || '[]'));
    } catch {}
    try {
      const key = getKey(user?.username);
      const raw = localStorage.getItem(key);
      setItems(raw ? JSON.parse(raw) : []);
    } catch { setItems([]); }
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      const key = getKey(user?.username);
      if (e.key === key) setItems(JSON.parse(e.newValue || '[]'));
      if (
        e.key === 'smart-student-teacher-assignments' ||
        e.key === 'smart-student-courses' ||
        e.key === 'smart-student-sections' ||
        e.key === 'smart-student-subjects' ||
        e.key === 'smart-student-admin-courses' ||
        e.key === 'smart-student-admin-sections'
      ) {
        computeTeacherAssignments();
      }
    };
    // Calcular asignaciones reales del profesor
    computeTeacherAssignments();

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [user?.username]);

  const computeTeacherAssignments = () => {
    try {
  if (!user || user.role !== 'teacher') { setAssignedCourses([]); setAssignedSubjectsByCourse({}); return; }
      const users = JSON.parse(localStorage.getItem('smart-student-users') || '[]');
      const fullUser = users.find((u: any) => u.username === user.username || u.id === user.id);
      const assignments = JSON.parse(localStorage.getItem('smart-student-teacher-assignments') || '[]');
      const sections = JSON.parse(localStorage.getItem('smart-student-sections') || '[]');
      const coursesAll = JSON.parse(localStorage.getItem('smart-student-courses') || '[]');

      const my = (assignments || []).filter((a: any) => a && (a.teacherId === fullUser?.id || a.teacherUsername === user.username));
      const courseIds = new Set<string>();
      const subsByCourse: Record<string, Array<{ id: string; name: string }>> = {};
      const subsCat = JSON.parse(localStorage.getItem('smart-student-subjects') || '[]');

      const getSubj = (sid?: any, sname?: any) => {
        const byId = subsCat.find((s: any) => String(s.id) === String(sid));
        if (byId) return { id: String(byId.id), name: String(byId.name || byId.id) };
        const byName = subsCat.find((s: any) => String(s.name) === String(sname));
        if (byName) return { id: String(byName.id || byName.name), name: String(byName.name || byName.id) };
        const n = String(sname || sid || '');
        return n ? { id: n, name: n } : undefined;
      };

      my.forEach((a: any) => {
        const sec = sections.find((s: any) => s.id === a.sectionId);
        const courseId = String(sec?.courseId || a.courseId || '');
        if (!courseId) return;
        courseIds.add(courseId);
        const subj = getSubj(a.subjectId, a.subjectName);
        if (!subj) return;
        if (!subsByCourse[courseId]) subsByCourse[courseId] = [];
        if (!subsByCourse[courseId].some(x => x.id === subj.id || x.name === subj.name)) subsByCourse[courseId].push(subj);
      });

      const ac = coursesAll.filter((c: any) => courseIds.has(String(c.id)));
      setAssignedCourses(ac);
      setAssignedSubjectsByCourse(subsByCourse);
    } catch (e) {
      console.error('[Slides] computeTeacherAssignments error', e);
      setAssignedCourses([]); setAssignedSubjectsByCourse({});
    }
  };

  const save = (list: SlideItem[]) => {
    const key = getKey(user?.username);
    setItems(list);
    localStorage.setItem(key, JSON.stringify(list));
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(list) }));
  };

  const resolveSubjectName = (id?: string | null) => {
    try {
      const subj = subjects.find((s: any) => String(s.id) === String(id)) || subjects.find((s: any) => String(s.name) === String(id));
      return subj?.name || (id ? String(id) : '');
    } catch { return id ? String(id) : ''; }
  };

  const resolveCourseLabel = (courseId?: string | null) => {
    try {
      const course = courses.find((c: any) => String(c.id) === String(courseId));
      return course?.name || '';
    } catch { return ''; }
  };

  const formatDateTime = (ts?: number) => {
    if (!ts) return '-';
    const d = new Date(ts);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  };

  const handleCreate = () => {
    if (!user) { alert('Usuario no autenticado'); return; }
  if (!draft.courseId || !draft.subjectId || !(String(draft.topic||'').trim())) {
      alert(translate('slidesSelectAllBeforeCreate') || translate('testsSelectAllBeforeCreate') || 'Complete curso, asignatura y tema.');
      return;
    }
    const now = Date.now();
    const subjName = resolveSubjectName(draft.subjectId);
    const item: SlideItem = {
      id: `slide_${now}`,
      title: draft.topic || translate('slidesUntitled') || 'Presentación',
      createdAt: now,
  courseId: draft.courseId,
      subjectId: draft.subjectId,
      subjectName: subjName,
      topic: draft.topic,
      slideCount: Number(draft.slideCount || 8),
      ownerId: user.id,
      ownerUsername: user.username,
      shared: false,
    };
    save([item, ...items]);
    setDraft({ slideCount: 8 });
  };

  const handleDelete = (id: string) => {
  if (!confirm(translate('slidesConfirmDelete') ?? '¿Eliminar presentación?')) return;
    save(items.filter(i => i.id !== id));
  };

  const handleShare = (it: SlideItem) => {
    try {
      const commKey = 'smart-student-communications';
      const all = JSON.parse(localStorage.getItem(commKey) || '[]');
      const entry = {
        id: `comm_${Date.now()}`,
        type: 'course',
        title: `${translate('slidesShareTitle') || 'Presentación compartida'}: ${it.topic || it.title}`,
        content: translate('slidesShareMessage') || 'El profesor ha compartido una presentación de clase.',
  targetCourse: it.courseId,
  targetSection: undefined,
  targetCourseName: (courses.find((c:any)=>String(c.id)===String(it.courseId))?.name)||'',
  targetSectionName: undefined,
        createdAt: Date.now(),
        readBy: [],
        attachment: { type: 'slide', slideId: it.id },
        sender: user?.id,
        senderName: user?.displayName || user?.username,
      };
      const next = [entry, ...all];
      localStorage.setItem(commKey, JSON.stringify(next));
      window.dispatchEvent(new StorageEvent('storage', { key: commKey, newValue: JSON.stringify(next) }));
      save(items.map(s => s.id === it.id ? { ...s, shared: true } : s));
      alert(translate('slidesSharedSuccess') || 'Presentación compartida con la sección');
    } catch (e) {
      console.error('[Slides] share error', e);
    }
  };

  const handleDownload = async (it: SlideItem) => {
    try {
  const mod: any = await import('pptxgenjs');
  const PptxGen = mod.default || mod;
  const pptx = new PptxGen();
      pptx.company = 'Smart Student';
      pptx.author = user?.displayName || user?.username || 'Teacher';
      const title = it.topic || it.title;
      const slide0 = pptx.addSlide();
      slide0.addText(title, { x: 0.5, y: 1.0, fontSize: 28, bold: true });
  slide0.addText(`${translate('slidesLabelSubject')}: ${it.subjectName || ''}`, { x: 0.5, y: 2.0, fontSize: 18 });
  slide0.addText(`${translate('slidesLabelCourse') || translate('slidesLabelCourseSection') || 'Curso'}: ${resolveCourseLabel(it.courseId)}`, { x: 0.5, y: 2.6, fontSize: 16 });
      slide0.addText(`${translate('slidesCreatedAt')}: ${formatDateTime(it.createdAt)}`, { x: 0.5, y: 3.2, fontSize: 12 });
      const count = Math.max(1, Number(it.slideCount || 8));
      for (let i = 0; i < count - 1; i++) {
  const s = pptx.addSlide();
  s.addText(`${title} — ${translate('slidesBulletKeyPoint')} ${i + 1}`, { x: 0.5, y: 0.6, fontSize: 22, bold: true });
        s.addText([
          { text: `• ${translate('slidesBulletKeyPoint')} #${i + 1}`, options: { fontSize: 16 }},
          { text: `\n• ${translate('slidesBulletExample')} ${i + 1}`, options: { fontSize: 16 }},
          { text: `\n• ${translate('slidesBulletSummary')}`, options: { fontSize: 16 }},
        ]);
      }
      const fileName = `${(title || 'presentacion').replace(/[^a-z0-9\-_]+/gi,'_')}.pptx`;
      await pptx.writeFile({ fileName });
    } catch (e) {
      console.error('[Slides] download error', e);
      alert('No se pudo generar PPTX. Instale dependencia pptxgenjs si falta.');
    }
  };

  const sorted = useMemo(() => {
    if (!user) return [] as SlideItem[];
    const list = items.filter(i => (i.ownerId === user.id) || (i.ownerUsername === user.username));
    return [...list].sort((a,b)=> b.createdAt - a.createdAt);
  }, [items, user]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <span className="inline-flex items-center justify-center rounded-md border border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200 p-1">
            <FileSpreadsheet className="size-5" />
          </span>
          <span>{translate('slidesPageTitle') || 'Presentaciones'}</span>
        </h1>
        <p className="text-sm text-muted-foreground">{translate('slidesPageSub') || 'Crea presentaciones PPTX por curso, sección y asignatura.'}</p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="text-sm font-medium">{translate('slidesCreateTitle') || 'Crear Presentación'}</div>
        <div className="text-xs text-muted-foreground">{translate('slidesCreateHint') || 'Seleccione curso, sección, asignatura y tema.'}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs block mb-2">{translate('slidesCourseLabel') || 'Curso'}</label>
            <div className="flex flex-wrap gap-2">
              {(assignedCourses.length > 0 ? assignedCourses : courses).map((c:any) => {
                const active = String(draft.courseId||'') === String(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setDraft((d:any)=> ({ ...d, courseId: c.id, subjectId: '' }))}
                    className={`px-3 py-1 rounded-full border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 ${active ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700' : 'bg-background text-foreground border-gray-300 dark:border-gray-700'} hover:border-emerald-400 hover:text-emerald-700 focus-visible:ring-emerald-500`}
                    aria-pressed={active}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
          {!!draft.courseId ? (
            <div>
              <label className="text-xs block mb-2">{translate('slidesSubjectLabel') || 'Asignatura'}</label>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const list = assignedSubjectsByCourse[draft.courseId] || [];
                  const unique: Array<{ id: string; name: string }> = [];
                  const seen = new Set<string>();
                  list.forEach(s => { const k = s.id || s.name; if (k && !seen.has(k)) { seen.add(k); unique.push(s); } });
                  return unique;
                })().map((s:any) => {
                  const sid = String(s.id || s.name);
                  const active = String(draft.subjectId||'') === sid;
                  return (
                    <button
                      key={sid}
                      type="button"
                      onClick={() => setDraft((d:any)=> ({ ...d, subjectId: sid }))}
                      className={`px-3 py-1 rounded-full border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 ${active ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700' : 'bg-background text-foreground border-gray-300 dark:border-gray-700'} hover:border-emerald-400 hover:text-emerald-700 focus-visible:ring-emerald-500`}
                      aria-pressed={active}
                    >
                      {s.name || s.id}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div aria-hidden className="hidden md:block" />
          )}
          <div>
            <label className="text-xs block mb-1">{translate('slidesTopicLabel') || 'Tema'}</label>
            <input className="w-full border rounded px-2 py-1 text-sm" value={draft.topic || ''} onChange={e=> setDraft((d:any)=> ({...d, topic: e.target.value }))} placeholder="Ej: Ecosistemas" />
          </div>
          <div>
            <label className="text-xs block mb-1">{translate('slidesSlidesCountLabel') || 'Cantidad de diapositivas'}</label>
            <input type="number" min={2} max={50} className="w-full border rounded px-2 py-1 text-sm" value={draft.slideCount || 10} onChange={e=> setDraft((d:any)=> ({...d, slideCount: Number(e.target.value) }))} />
          </div>
        </div>
        {(() => {
          const canGenerate = Boolean(draft.courseId && draft.subjectId && String(draft.topic||'').trim());
          return (
            <div>
              <Button
                onClick={handleCreate}
                disabled={!canGenerate}
                className={`px-4 py-2 text-sm font-medium rounded-md focus-visible:outline-none focus-visible:ring-2 ${canGenerate ? 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500' : 'bg-gray-200 text-gray-500 cursor-not-allowed focus-visible:ring-gray-300'}`}
              >
                {translate('slidesGenerateBtn') || 'Generar'}
              </Button>
            </div>
          );
        })()}
      </Card>

      <Card className="p-4">
        <div className="text-sm font-medium mb-2">{translate('slidesHistoryTitle') || 'Historial de Presentaciones'}</div>
        {sorted.length === 0 ? (
          <div className="text-xs text-muted-foreground">{translate('slidesHistoryEmpty') || 'No hay presentaciones'}</div>
        ) : (
          <div className="divide-y">
            {sorted.map((it) => (
              <div key={it.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{it.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{translate('slidesLabelCourse') || 'Curso'}: {resolveCourseLabel(it.courseId)}</div>
                  <div className="text-xs text-muted-foreground truncate">{translate('slidesLabelSubject')}: {it.subjectName}</div>
                  <div className="text-xs text-muted-foreground truncate">{translate('slidesCreatedAt')}: {formatDateTime(it.createdAt)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="p-2 text-emerald-600 hover:text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500 border-emerald-300 hover:border-emerald-400"
                    onClick={() => { setDraft({
                      courseId: it.courseId, subjectId: it.subjectId, topic: it.topic, slideCount: it.slideCount,
                    }); setEditingId(it.id); }}
                    title={translate('slidesBtnEdit') || 'Editar'}
                    aria-label={translate('slidesBtnEdit') || 'Editar'}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="outline" className="p-2 text-emerald-600 hover:text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500 border-emerald-300 hover:border-emerald-400" onClick={() => handleDownload(it)} title={translate('slidesBtnDownload') || 'Descargar'} aria-label={translate('slidesBtnDownload') || 'Descargar'}><Download className="size-4" /></Button>
                  <Button variant="outline" className="p-2 text-emerald-600 hover:text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500 border-emerald-300 hover:border-emerald-400" onClick={() => handleShare(it)} title={translate('slidesBtnShare') || 'Compartir'} aria-label={translate('slidesBtnShare') || 'Compartir'}><Share2 className="size-4" /></Button>
                  <Button variant="outline" className="p-2 text-emerald-600 hover:text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500 border-emerald-300 hover:border-emerald-400" onClick={() => handleDelete(it.id)} title={translate('slidesBtnDelete') || 'Eliminar'} aria-label={translate('slidesBtnDelete') || 'Eliminar'}><Trash2 className="size-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {editingId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-background rounded-md p-4 w-full max-w-2xl">
            <div className="flex items-center justify-between mb-2">
              <div className="text-lg font-semibold">{translate('slidesEditTitle') || 'Editar Presentación'}</div>
              <button onClick={() => setEditingId(null)}>✖</button>
            </div>
            <div className="text-xs text-muted-foreground mb-3">{translate('slidesEditHint') || 'Actualice los datos y guarde.'}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs block mb-2">{translate('slidesCourseLabel') || 'Curso'}</label>
                <div className="flex flex-wrap gap-2">
                  {(assignedCourses.length > 0 ? assignedCourses : courses).map((c:any) => {
                    const active = String(draft.courseId||'') === String(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setDraft((d:any)=> ({ ...d, courseId: c.id, subjectId: '' }))}
                        className={`px-3 py-1 rounded-full border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 ${active ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700' : 'bg-background text-foreground border-gray-300 dark:border-gray-700'} hover:border-emerald-400 hover:text-emerald-700 focus-visible:ring-emerald-500`}
                        aria-pressed={active}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              {!!draft.courseId && (
                <div>
                  <label className="text-xs block mb-2">{translate('slidesSubjectLabel') || 'Asignatura'}</label>
                  <div className="flex flex-wrap gap-2">
                    {(assignedSubjectsByCourse[draft.courseId] || []).map((s:any) => {
                      const sid = String(s.id || s.name);
                      const active = String(draft.subjectId||'') === sid;
                      return (
                        <button
                          key={sid}
                          type="button"
                          onClick={() => setDraft((d:any)=> ({ ...d, subjectId: sid }))}
                          className={`px-3 py-1 rounded-full border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 ${active ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700' : 'bg-background text-foreground border-gray-300 dark:border-gray-700'} hover:border-emerald-400 hover:text-emerald-700 focus-visible:ring-emerald-500`}
                          aria-pressed={active}
                        >
                          {s.name || s.id}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs block mb-1">{translate('slidesTopicLabel') || 'Tema'}</label>
                <input className="w-full border rounded px-2 py-1 text-sm" value={draft.topic || ''} onChange={e=> setDraft((d:any)=> ({...d, topic: e.target.value }))} placeholder="Ej: Ecosistemas" />
              </div>
              <div>
                <label className="text-xs block mb-1">{translate('slidesSlidesCountLabel') || 'Cantidad de diapositivas'}</label>
                <input type="number" min={2} max={50} className="w-full border rounded px-2 py-1 text-sm" value={draft.slideCount || 10} onChange={e=> setDraft((d:any)=> ({...d, slideCount: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                className="p-2 text-emerald-600 hover:text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500 border-emerald-300 hover:border-emerald-400"
                onClick={()=> setEditingId(null)}
                title={translate('cancelButton') || 'Cancelar'}
                aria-label={translate('cancelButton') || 'Cancelar'}
              >
                <X className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="p-2 text-emerald-600 hover:text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500 border-emerald-300 hover:border-emerald-400"
                onClick={() => {
                if (!draft.courseId || !draft.subjectId) { alert(translate('slidesSelectAllBeforeCreate') || 'Complete los campos'); return; }
                const subjName = resolveSubjectName(draft.subjectId);
                const next = items.map(it => it.id === editingId ? { ...it, courseId: draft.courseId, subjectId: draft.subjectId, subjectName: subjName, topic: draft.topic, slideCount: Number(draft.slideCount || 10) } : it);
                save(next);
                setEditingId(null);
              }}
                title={translate('updateButton') || 'Actualizar'}
                aria-label={translate('updateButton') || 'Actualizar'}
              >
                <Check className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
