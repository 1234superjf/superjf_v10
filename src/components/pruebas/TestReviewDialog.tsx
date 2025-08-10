"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"

type QuestionTF = { id: string; type: "tf"; text: string; answer: boolean; explanation?: string }
type QuestionMC = { id: string; type: "mc"; text: string; options: string[]; correctIndex: number }
type QuestionMS = { id: string; type: "ms"; text: string; options: Array<{ text: string; correct: boolean }> }
type QuestionDES = { id: string; type: "des"; prompt: string; sampleAnswer?: string }
type AnyQuestion = QuestionTF | QuestionMC | QuestionMS | QuestionDES

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  // Aceptamos el TestItem completo tal como se pasa desde PruebasPage
  test?: {
    id: string
    title: string
    description?: string
    questions?: AnyQuestion[]
    courseId?: string
    sectionId?: string
    subjectId?: string
    subjectName?: string
    topic?: string
    createdAt?: number
  }
}

type OCRResult = {
  text: string
  confidence?: number
}

export default function TestReviewDialog({ open, onOpenChange, test }: Props) {
  const { translate } = useLanguage()
  const [file, setFile] = useState<File | null>(null)
  const [ocr, setOcr] = useState<OCRResult | null>(null)
  const [processing, setProcessing] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [studentName, setStudentName] = useState<string>("")
  const [error, setError] = useState<string>("")
  const workerRef = useRef<any>(null)
  const [history, setHistory] = useState<ReviewRecord[]>([])
  const [verification, setVerification] = useState<{ sameDocument: boolean; coverage: number; studentFound: boolean; studentId?: string | null }>({ sameDocument: false, coverage: 0, studentFound: false, studentId: null })

  useEffect(() => {
    if (!open) {
      // reset al cerrar
      setFile(null)
      setOcr(null)
      setProcessing(false)
      setScore(null)
      setStudentName("")
      setError("")
      setVerification({ sameDocument: false, coverage: 0, studentFound: false, studentId: null })
    }
  }, [open])

  // Cargar historial de la prueba seleccionada
  useEffect(() => {
    if (!test?.id) return
    try {
      const key = getReviewKey(test.id)
      const raw = localStorage.getItem(key)
      if (raw) setHistory(JSON.parse(raw))
      else setHistory([])
    } catch (e) {
      console.warn('[TestReview] No se pudo cargar historial:', e)
      setHistory([])
    }
  }, [test?.id, open])

  const ensureWorker = useCallback(async () => {
    if (workerRef.current) return workerRef.current
    try {
      // Carga dinámica para reducir bundle inicial
      const Tesseract = await import("tesseract.js")
      workerRef.current = Tesseract
      return Tesseract
    } catch (e) {
      console.error("No se pudo cargar Tesseract.js", e)
      throw new Error("OCR no disponible")
    }
  }, [])

  const extractTextFromPDF = async (file: File): Promise<string> => {
    // Estrategia simple: renderizar primera página como imagen usando PDF.js sería ideal,
    // pero para un andamiaje mantenemos soporte directo de imágenes.
    // Si el archivo es PDF, pedimos al usuario subir imagen o usamos el primer frame vía <img src=objectURL> en canvas.
    // Aquí devolvemos un aviso.
    return "[PDF detectado] Convierte a imagen para OCR o integra PDF.js para rasterizar páginas."
  }

  const runOCR = useCallback(async () => {
    if (!file) return
    setProcessing(true)
    setError("")
    try {
      const Tesseract = await ensureWorker()
      let text = ""
      if (file.type === "application/pdf") {
        text = await extractTextFromPDF(file)
      } else {
        const { data } = await Tesseract.recognize(file, "spa+eng", {
          tessedit_char_whitelist: undefined,
        } as any)
        text = data?.text || ""
      }
      const guessedName = guessStudentName(text)
      setStudentName(guessedName)
      setOcr({ text })
      // 1) Verificar si corresponde a la misma prueba
      const sameDoc = verifySameDocument(text, test?.questions || [])
      // 2) Verificar si el estudiante existe en la sección del test
      const studentInfo = findStudentInSection(guessedName, test?.courseId, test?.sectionId)
      setVerification({ sameDocument: sameDoc.isMatch, coverage: sameDoc.coverage, studentFound: !!studentInfo, studentId: studentInfo?.id || null })
      // 3) Si ambas verificaciones pasan, calificar
      let computed: number | null = null
      if (sameDoc.isMatch && studentInfo) {
        computed = autoGrade(text, test?.questions || [])
      }
      setScore(computed)
      // 4) Guardar en historial
      persistReview({
        testId: test?.id || '',
        uploadedAt: Date.now(),
        studentName: guessedName || '',
        studentId: studentInfo?.id || null,
        courseId: test?.courseId || null,
        sectionId: test?.sectionId || null,
        subjectId: test?.subjectId || null,
        subjectName: test?.subjectName || null,
        topic: test?.topic || '',
        score: typeof computed === 'number' ? computed : null,
        sameDocument: sameDoc.isMatch,
        coverage: sameDoc.coverage,
        studentFound: !!studentInfo,
      })
    } catch (e: any) {
      console.error(e)
      setError(e?.message || "Error al procesar OCR")
    } finally {
      setProcessing(false)
    }
  }, [file, ensureWorker, test?.questions])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{translate('testsReviewTitlePrefix')} {test?.title || translate('testsPageTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              id="review-file-input"
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFile}
              className="hidden"
              aria-label={translate('testsReviewSelectFileAria')}
            />
            <label
              htmlFor="review-file-input"
              className="inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium bg-fuchsia-600 text-white hover:bg-fuchsia-700 cursor-pointer"
            >
              {translate('testsReviewSelectFile')}
            </label>
            <span className="text-sm text-muted-foreground truncate">
              {file?.name || translate('testsReviewNoFile')}
            </span>
          </div>
          <div className="flex gap-2">
            <Button onClick={runOCR} disabled={!file || processing}>
              {processing ? translate('testsReviewProcessing') : translate('testsReviewRunOCR')}
            </Button>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          {ocr && (
            <div className="border rounded-md p-3 space-y-2">
              <div className="text-sm">
                <span className="font-medium">{translate('testsReviewStudent')}</span> {studentName || translate('testsReviewNotDetected')}
              </div>
              <div className="text-xs text-muted-foreground">
                {verification.sameDocument ? `✅ ${translate('testsReviewDocMatches')}` : `⚠️ ${translate('testsReviewDocNotMatch')}`} {verification.coverage ? `(${Math.round(verification.coverage * 100)}% ${translate('testsReviewCoverage')})` : ''}
              </div>
              <div className="text-xs text-muted-foreground">
                {verification.studentFound ? `✅ ${translate('testsReviewStudentInSection')}` : `⚠️ ${translate('testsReviewStudentNotInSection')}`}
              </div>
              <div className="text-sm">
                <span className="font-medium">{translate('testsReviewScore')}</span> {typeof score === 'number' ? score : '-'}
              </div>
              <details className="text-xs text-muted-foreground">
                <summary>{translate('testsReviewOcrText')}</summary>
                <pre className="whitespace-pre-wrap">{ocr.text}</pre>
              </details>
            </div>
          )}

          {/* Historial de revisión */}
          <div className="border rounded-md p-3 space-y-2">
            <div className="text-sm font-medium">{translate('testsReviewHistoryTitle') || 'Historial de revisión'}</div>
            {history.length === 0 ? (
              <div className="text-xs text-muted-foreground">{translate('testsReviewHistoryEmpty') || 'Sin registros'}</div>
            ) : (
              <div className="overflow-x-auto">
        <table className="w-full text-xs">
      <thead className="text-muted-foreground">
                    <tr>
    <th className="text-left py-1 pr-2">{translate('testsReviewHistoryColStudent')}</th>
    <th className="text-left py-1 pr-2">{translate('testsReviewHistoryColCourseSection')}</th>
    <th className="text-left py-1 pr-2">{translate('testsReviewHistoryColSubject')}</th>
    <th className="text-left py-1 pr-2">{translate('testsReviewHistoryColTopic')}</th>
    <th className="text-left py-1 pr-2">{translate('testsReviewHistoryColUploadedAt')}</th>
    <th className="text-left py-1 pr-2">{translate('testsReviewHistoryColScore')}</th>
    <th className="text-left py-1 pr-2" title={translate('testsReviewHistoryColDocHelp')}>{translate('testsReviewHistoryColDoc')}</th>
    <th className="text-left py-1 pr-2" title={translate('testsReviewHistoryColSectionOkHelp')}>{translate('testsReviewHistoryColSectionOk')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h, idx) => (
                      <tr key={`${h.uploadedAt}-${idx}`} className="border-t">
                        <td className="py-1 pr-2">{h.studentName}</td>
                        <td className="py-1 pr-2">{resolveCourseSectionLabel(h.courseId, h.sectionId)}</td>
                        <td className="py-1 pr-2">{resolveSubjectName(h.subjectId, h.subjectName)}</td>
                        <td className="py-1 pr-2">{h.topic || '-'}</td>
                        <td className="py-1 pr-2">{formatDateTime(h.uploadedAt)}</td>
                        <td className="py-1 pr-2">{typeof h.score === 'number' ? h.score : '-'}</td>
                        <td className="py-1 pr-2">{h.sameDocument ? '✔' : '✖'}</td>
                        <td className="py-1 pr-2">{h.studentFound ? '✔' : '✖'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function guessStudentName(text: string): string {
  // heurística simple: buscar "Nombre:" o líneas iniciales con dos palabras capitalizadas
  const nameLabel = /(?:Nombre|Estudiante)\s*[:\-]\s*(.+)/i
  const m = text.match(nameLabel)
  if (m?.[1]) {
    return m[1].split("\n")[0].trim()
  }
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  for (const l of lines.slice(0, 10)) {
    if (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+/.test(l)) {
      return l
    }
  }
  return ""
}

function autoGrade(text: string, questions: AnyQuestion[]): number {
  if (!questions?.length) return 0
  // Heurística simple:
  // - TF: si aparece "V"/"F" y coincide con la respuesta esperada, cuenta.
  // - MC: si aparece la alternativa correcta (por texto), cuenta.
  // - MS: si aparecen dos o más correctas, cuenta.
  // - DES: no se califica automáticamente (0 o ignora).
  let correct = 0
  for (const q of questions) {
    if ((q as any).type === "tf") {
      const tf = q as QuestionTF
      // Buscar líneas como "1) V" o "1) F" según contexto; aquí buscamos letra V/F sin contexto robusto.
      const hasV = /\bV\b/.test(text)
      const hasF = /\bF\b/.test(text)
      if ((tf.answer && hasV) || (!tf.answer && hasF)) correct++
      continue
    }
    if ((q as any).type === "mc") {
      const mc = q as QuestionMC
      const correctText = mc.options[mc.correctIndex]
      const pattern = new RegExp((correctText || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      if (pattern.test(text)) correct++
      continue
    }
    if ((q as any).type === "ms") {
      const ms = q as QuestionMS
      const corrects = ms.options.filter(o => o.correct)
      let hits = 0
      for (const opt of corrects) {
        const pattern = new RegExp((opt.text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
        if (pattern.test(text)) hits++
      }
      if (hits >= Math.max(1, Math.floor(corrects.length / 2))) correct++
      continue
    }
    // des: no califica automáticamente
  }
  // retorno como porcentaje 0-100
  return Math.round((correct / questions.length) * 100)
}

// ===== Utilidades nuevas =====

type ReviewRecord = {
  testId: string
  uploadedAt: number
  studentName: string
  studentId: string | null
  courseId: string | null
  sectionId: string | null
  subjectId: string | null
  subjectName: string | null
  topic: string
  score: number | null
  sameDocument: boolean
  coverage: number
  studentFound: boolean
}

function getReviewKey(testId: string) {
  return `smart-student-test-reviews_${testId}`
}

function persistReview(r: ReviewRecord) {
  try {
    const key = getReviewKey(r.testId)
    const prev: ReviewRecord[] = JSON.parse(localStorage.getItem(key) || '[]')
    const next = [r, ...prev].slice(0, 200)
    localStorage.setItem(key, JSON.stringify(next))
    // Intentar notificar si hay listeners
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(next) }))
  } catch (e) {
    console.warn('[TestReview] No se pudo guardar historial:', e)
  }
}

function normalize(s: string) {
  try {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  } catch {
    return s || ''
  }
}

function verifySameDocument(ocrText: string, questions: AnyQuestion[]) {
  if (!questions?.length) return { isMatch: false, coverage: 0 }
  const text = normalize(ocrText)
  let matched = 0
  let checked = 0
  for (const q of questions) {
    let stem = ''
    if ((q as any).type === 'tf' || (q as any).type === 'mc' || (q as any).type === 'ms') {
      stem = normalize((q as any).text || '')
    } else if ((q as any).type === 'des') {
      stem = normalize((q as any).prompt || '')
    }
    if (!stem || stem.length < 8) continue // ignorar stems muy cortos
    checked++
    if (text.includes(stem.slice(0, Math.min(40, stem.length)))) matched++
  }
  const coverage = checked > 0 ? matched / checked : 0
  const isMatch = coverage >= 0.5
  return { isMatch, coverage }
}

function findStudentInSection(guessedName: string, courseId?: string | null, sectionId?: string | null) {
  try {
    if (!sectionId) return null
    const users = JSON.parse(localStorage.getItem('smart-student-users') || '[]') as any[]
    const target = normalize(guessedName)
    const list = users.filter(u => (u.role === 'student' || u.role === 'estudiante') && String(u.sectionId) === String(sectionId))
    for (const u of list) {
      const dn = normalize(u.displayName || '')
      const un = normalize(u.username || '')
      if (!target) continue
      if (dn.includes(target) || target.includes(dn) || un === target) return u
    }
    return null
  } catch {
    return null
  }
}

function resolveCourseSectionLabel(courseId?: string | null, sectionId?: string | null) {
  try {
    const courses = JSON.parse(localStorage.getItem('smart-student-courses') || '[]')
    const sections = JSON.parse(localStorage.getItem('smart-student-sections') || '[]')
    const sec = sections.find((s: any) => String(s.id) === String(sectionId))
    const course = courses.find((c: any) => String(c.id) === String(courseId || sec?.courseId))
    const courseLabel = course?.name ? String(course.name) : ''
    const sectionLabel = sec?.name ? String(sec.name) : ''
    return [courseLabel, sectionLabel].filter(Boolean).join(' ')
  } catch {
    return ''
  }
}

function resolveSubjectName(subjectId?: string | null, subjectName?: string | null) {
  try {
    const subjects = JSON.parse(localStorage.getItem('smart-student-subjects') || '[]')
    const subj = subjects.find((s: any) => String(s.id) === String(subjectId)) || subjects.find((s: any) => String(s.name) === String(subjectId))
    return subj?.name || subjectName || ''
  } catch {
    return subjectName || ''
  }
}

function formatDateTime(ts?: number) {
  try {
    if (!ts) return '-'
    const d = new Date(ts)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
  } catch { return '-' }
}
