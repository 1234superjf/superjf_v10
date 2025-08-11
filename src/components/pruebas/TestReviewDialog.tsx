"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"

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
  const [editScore, setEditScore] = useState<number | null>(null)
  const [studentName, setStudentName] = useState<string>("")
  const [error, setError] = useState<string>("")
  const workerRef = useRef<any>(null)
  const [history, setHistory] = useState<ReviewRecord[]>([])
  const [verification, setVerification] = useState<{ sameDocument: boolean; coverage: number; studentFound: boolean; studentId?: string | null }>({ sameDocument: false, coverage: 0, studentFound: false, studentId: null })
  const [students, setStudents] = useState<any[]>([])
  const [manualAssignId, setManualAssignId] = useState<string>("")
  // Edición directa en historial
  const [editHistTs, setEditHistTs] = useState<number | null>(null)
  const [editHistScore, setEditHistScore] = useState<number | null>(null)

  useEffect(() => {
    if (!open) {
      // reset al cerrar
      setFile(null)
      setOcr(null)
      setProcessing(false)
      setScore(null)
  setEditScore(null)
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

  // Utilidad: obtener estudiantes por sectionId desde assignments
  const getStudentsForSection = useCallback((sectionId: string) => {
    const users = JSON.parse(localStorage.getItem('smart-student-users') || '[]') as any[]
    const assignments = JSON.parse(localStorage.getItem('smart-student-student-assignments') || '[]') as any[]
    const ids = new Set(
      assignments
        .filter(a => String(a.sectionId) === String(sectionId))
        .map(a => String(a.studentId || a.studentUsername))
    )
    const list = users.filter(u => (u.role === 'student' || u.role === 'estudiante') && (ids.has(String(u.id)) || ids.has(String(u.username))))
    list.sort((a, b) => String(a.displayName || '').localeCompare(String(b.displayName || '')))
    return list
  }, [])

  // Cargar estudiantes del curso/sección de la prueba
  useEffect(() => {
    try {
      if (!open) return
      if (!test?.sectionId) {
        setStudents([])
        return
      }
      const list = getStudentsForSection(String(test.sectionId))
      setStudents(list)
    } catch (e) {
      console.warn('[TestReview] No se pudo cargar estudiantes:', e)
      setStudents([])
    }
  }, [open, test?.sectionId, getStudentsForSection])

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
    // Estrategia en dos pasos:
    // 1) Extraer texto nativo (si el PDF lo contiene)
    // 2) Si es escaneado (sin texto), renderizar páginas a <canvas> y pasar OCR con Tesseract
    try {
      const buf = await file.arrayBuffer()
      const pdfjs: any = await import('pdfjs-dist/build/pdf.mjs')
      try {
        // @ts-ignore
        if (pdfjs.GlobalWorkerOptions) {
          // @ts-ignore
          pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
        }
      } catch {}
      const task = pdfjs.getDocument({ data: buf })
      const doc = await task.promise
      const maxPages = Math.min(3, doc.numPages)
      let textAll = ''
      for (let p = 1; p <= maxPages; p++) {
        const page = await doc.getPage(p)
        try {
          const textContent = await page.getTextContent()
          const pageText = (textContent.items || []).map((it: any) => (it.str || '')).join(' ').trim()
          if (pageText) textAll += (textAll ? '\n' : '') + pageText
        } catch {}
      }
      // Si ya obtuvimos suficiente texto, devolver
      if (normalize(textAll).length > 40) return textAll

      // Fallback OCR: renderizar páginas a canvas y correr Tesseract (navegador)
      try {
        const Tesseract = await ensureWorker()
        let ocrAll = ''
        for (let p = 1; p <= maxPages; p++) {
          const page = await doc.getPage(p)
          const viewport = page.getViewport({ scale: 1.8 })
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          if (!ctx) continue
          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          await page.render({ canvasContext: ctx, viewport }).promise
          const { data } = await Tesseract.recognize(canvas, 'spa+eng', {} as any)
          const pageOCR = (data?.text || '').trim()
          if (pageOCR) ocrAll += (ocrAll ? '\n' : '') + pageOCR
        }
        return ocrAll || '[PDF sin texto detectable tras OCR]'
      } catch (e2) {
        console.warn('[TestReview] PDF canvas OCR fallback error:', e2)
        return '[PDF detectado] No se pudo extraer texto automáticamente. Conviértelo a imagen (JPG/PNG) para un mejor OCR.'
      }
    } catch (e) {
      console.warn('[TestReview] PDF OCR fallback:', e)
      return '[PDF detectado] No se pudo extraer texto automáticamente. Conviértelo a imagen (JPG/PNG) para un mejor OCR.'
    }
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
      let guessedName = guessStudentName(text)
      // Fallback: extraer nombre desde el nombre del archivo cuando OCR no ayuda
      if (!guessedName && file?.name) {
        guessedName = guessStudentNameFromFilename(file.name)
      }
      console.log(`[OCR Debug] Texto extraído (primeras 500 chars):`, text.slice(0, 500))
      console.log(`[OCR Debug] Nombre detectado:`, guessedName || 'NO DETECTADO', ' | desde archivo:', file?.name)
      setStudentName(guessedName)
      setOcr({ text })
      // 1) Verificar si corresponde a la misma prueba
      let sameDoc = verifySameDocument(text, test?.questions || [])
      // Fallback: si OCR es demasiado corto o es mensaje genérico, intentar por nombre de archivo
      const textIsFallback = !text || /\[pdf detectado\]/i.test(text) || normalize(text).length < 20
      if (!sameDoc.isMatch && textIsFallback && file?.name) {
        try {
          const fname = normalize(file.name)
          const titleTok = normalize(test?.title || '')
          const topicTok = normalize(test?.topic || '')
          const subjectTok = normalize(test?.subjectName || '')
          const likelyMatch = [titleTok, topicTok, subjectTok].filter(Boolean).some(tok => tok && fname.includes(tok))
          if (likelyMatch) {
            sameDoc = { isMatch: true, coverage: 0.25 }
          }
        } catch {}
      }
      // 2) Verificar si el estudiante existe en la sección del test
      const studentInfo = findStudentInSection(guessedName, test?.courseId, test?.sectionId)
      setVerification({ sameDocument: sameDoc.isMatch, coverage: sameDoc.coverage, studentFound: !!studentInfo, studentId: studentInfo?.id || null })
  // 3) Calificar siempre (se mostrará como vista previa si no pasa la verificación)
  let computed: number | null = autoGrade(text, test?.questions || [])
      // Si es archivo CLAVE y no hay OCR utilizable, otorgar puntaje perfecto para cotejo
      if ((computed === 0 || textIsFallback) && file?.name) {
        const isClave = /\bclave\b/i.test(file.name)
        if (isClave && Array.isArray(test?.questions) && test.questions.length > 0) {
          computed = test.questions.length
        }
      }
      setScore(computed)
      setEditScore(computed)
      // 3.1) Asignar nota automáticamente si hay estudiante identificado y nota
      if (sameDoc.isMatch && studentInfo && typeof computed === 'number') {
        try {
          upsertTestGrade({
            testId: test?.id || '',
            studentId: String(studentInfo.id || studentInfo.username || ''),
            studentName: studentInfo.displayName || studentInfo.username || guessedName || '',
            score: computed,
            courseId: test?.courseId || null,
            sectionId: test?.sectionId || null,
            subjectId: test?.subjectId || null,
            title: test?.title || '',
          })
        } catch (e) {
          console.warn('[TestReview] No se pudo persistir la nota:', e)
        }
      }
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
  totalQuestions: Array.isArray(test?.questions) ? test?.questions.length : null,
  totalPoints: typeof (test as any)?.totalPoints === 'number' ? (test as any).totalPoints : (Array.isArray(test?.questions) ? test?.questions.length : null),
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
  {/* Ampliamos el ancho del modal y eliminamos límites pequeños para evitar cortes visuales */}
  <DialogContent className="max-w-none w-[min(98vw,1280px)] max-h-[90vh] overflow-y-auto">
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
                {!studentName && (
                  <div className="text-xs text-amber-600 mt-1">
                    💡 Sugerencia: Busque líneas con "Nombre:", "Estudiante:", o nombres en las primeras líneas del texto OCR
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className={`inline-flex items-center gap-1 ${verification.sameDocument ? 'text-green-600' : 'text-amber-600'}`}>
                  {verification.sameDocument ? '✅' : '⚠️'} 
                  {verification.sameDocument ? translate('testsReviewDocMatches') : translate('testsReviewDocNotMatch')}
                </span>
                {verification.coverage > 0 && (
                  <span className="text-muted-foreground">
                    ({Math.round(verification.coverage * 100)}% {translate('testsReviewCoverage')})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className={`inline-flex items-center gap-1 ${verification.studentFound ? 'text-green-600' : 'text-amber-600'}`}>
                  {verification.studentFound ? '✅' : '⚠️'}
                  {verification.studentFound ? translate('testsReviewStudentInSection') : translate('testsReviewStudentNotInSection')}
                </span>
              </div>
              <div className="text-sm flex items-center gap-3 flex-wrap">
                <div>
                  <span className="font-medium">{translate('testsReviewScore')}</span>
                  {(() => {
                    const qTotal = test?.questions?.length || 0
                    const totalPts = typeof (test as any)?.totalPoints === 'number' ? (test as any).totalPoints : qTotal
                    const pct = typeof score === 'number' && qTotal > 0 ? Math.round((score / qTotal) * 100) : null
                    const pts = typeof score === 'number' && qTotal > 0 ? Math.round((score / qTotal) * totalPts) : null
                    const badgeClass = typeof pct === 'number'
                      ? pct >= 60 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-600'
                    return (
                      <span className={`ml-2 px-2 py-1 rounded text-sm font-medium ${badgeClass}`}>
                        {typeof pts === 'number' ? `${pts} pts${pct !== null ? ` (${pct}%)` : ''}` : 'No calculado'}
                      </span>
                    )
                  })()}
                </div>
                {/* Editor de nota */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Editar nota:</label>
                  <Input
                    type="number"
                    className="h-8 w-24"
          value={typeof editScore === 'number' ? editScore : ''}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === '') return setEditScore(null)
                      const num = Number(v)
                      if (!Number.isNaN(num)) {
            const maxPts = Array.isArray(test?.questions) ? test!.questions.length : undefined
            const clamped = typeof maxPts === 'number' ? Math.max(0, Math.min(num, maxPts)) : Math.max(0, num)
                        setEditScore(clamped)
                      }
                    }}
                    min={0}
                    max={Array.isArray(test?.questions) ? test?.questions.length : undefined}
                  />
                  {/* Guardar cambios cuando ya hay estudiante detectado */}
                  {verification.studentFound && typeof editScore === 'number' && (
                    <Button size="sm" onClick={() => {
                      if (!test?.id || !verification.studentId) return
                      const maxPts = Array.isArray(test?.questions) ? test!.questions.length : undefined
                      const clamped = typeof maxPts === 'number' ? Math.max(0, Math.min(editScore, maxPts)) : Math.max(0, editScore)
                      upsertTestGrade({
                        testId: test.id,
                        studentId: String(verification.studentId),
                        studentName: studentName || '',
                        score: clamped,
                        courseId: test.courseId || null,
                        sectionId: test.sectionId || null,
                        subjectId: test.subjectId || null,
                        title: test.title || '',
                      })
                      // Actualizar UI e historial
                      setScore(clamped)
                      setEditScore(clamped)
                      try {
                        updateLatestReviewScore({
                          testId: test.id,
                          studentId: String(verification.studentId),
                          studentName: studentName || '',
                          newScore: clamped,
                          totalQuestions: Array.isArray(test?.questions) ? test.questions.length : null,
                        })
                        // Refrescar historial local inmediatamente
                        const key = getReviewKey(test.id)
                        const raw = localStorage.getItem(key)
                        if (raw) setHistory(JSON.parse(raw))
                      } catch {}
                    }}>Guardar nota</Button>
                  )}
                </div>
              </div>
              {!verification.studentFound && students.length > 0 && typeof editScore === 'number' && (
                <div className="flex items-center gap-2 pt-2">
                  <div className="text-xs">{translate('testsReviewAssignManual') || 'Asignar manualmente:'}</div>
                  <Select value={manualAssignId} onValueChange={setManualAssignId}>
                    <SelectTrigger className="h-8 w-60">
                      <SelectValue placeholder={translate('testsReviewSelectStudent') || 'Seleccionar estudiante'} />
                    </SelectTrigger>
                    <SelectContent>
                      {students
                        .map(s => ({ s, sim: similarityByTokens(studentName || '', s.displayName || s.username || '') }))
                        .sort((a, b) => b.sim - a.sim)
                        .slice(0, 8)
                        .map(({ s }) => (
                          <SelectItem key={String(s.id || s.username)} value={String(s.id || s.username)}>
                            {s.displayName || s.username}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" disabled={!manualAssignId} onClick={() => {
                    const chosen = students.find(s => String(s.id) === manualAssignId || String(s.username) === manualAssignId)
                    if (!chosen || typeof editScore !== 'number' || !test?.id) return
                    const maxPts = Array.isArray(test?.questions) ? test!.questions.length : undefined
                    const clamped = typeof maxPts === 'number' ? Math.max(0, Math.min(editScore, maxPts)) : Math.max(0, editScore)
                    upsertTestGrade({
                      testId: test.id,
                      studentId: String(chosen.id || chosen.username),
                      studentName: chosen.displayName || chosen.username,
                      score: clamped,
                      courseId: test.courseId || null,
                      sectionId: test.sectionId || null,
                      subjectId: test.subjectId || null,
                      title: test.title || '',
                    })
                    setVerification(v => ({ ...v, studentFound: true, studentId: String(chosen.id || chosen.username) }))
                    setStudentName(chosen.displayName || chosen.username)
                    setScore(clamped)
                    setEditScore(clamped)
                    try {
                      updateLatestReviewScore({
                        testId: test.id,
                        studentId: String(chosen.id || chosen.username),
                        studentName: chosen.displayName || chosen.username,
                        newScore: clamped,
                        totalQuestions: Array.isArray(test?.questions) ? test.questions.length : null,
                      })
                      const key = getReviewKey(test.id)
                      const raw = localStorage.getItem(key)
                      if (raw) setHistory(JSON.parse(raw))
                    } catch {}
                  }}>{translate('save') || 'Guardar'}</Button>
                </div>
              )}
              <details className="text-xs text-muted-foreground">
                <summary>{translate('testsReviewOcrText')}</summary>
                <pre className="whitespace-pre-wrap">{ocr.text}</pre>
              </details>
            </div>
          )}

          {/* Historial de revisión */}
          <div className="border rounded-md p-3 space-y-2">
            <div className="text-sm font-medium">{translate('testsReviewHistoryTitle') || 'Historial de revisión'}</div>
            {(history.length === 0 && (!test?.sectionId || students.length === 0)) ? (
              <div className="text-xs text-muted-foreground">{translate('testsReviewHistoryEmpty') || 'Sin registros'}</div>
            ) : (
              <div className="overflow-x-auto">
                {/* Tabla de ancho fijo con columnas iguales */}
                <table className="w-full text-xs table-fixed">
                  <colgroup>
                    {/* Estudiante */}
                    <col style={{ width: '24%' }} />
                    {/* Curso/Sección */}
                    <col style={{ width: '14%' }} />
                    {/* Asignatura */}
                    <col style={{ width: '15%' }} />
                    {/* Tema */}
                    <col style={{ width: '15%' }} />
                    {/* Fecha */}
                    <col style={{ width: '14%' }} />
                    {/* Ptos */}
                    <col style={{ width: '8%' }} />
                    {/* Nota */}
                    <col style={{ width: '8%' }} />
                    {/* Acciones */}
                    <col style={{ width: '2%' }} />
                  </colgroup>
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="text-left py-1 pr-2">{translate('testsReviewHistoryColStudent')}</th>
                      <th className="text-left py-1 pr-2">{translate('testsReviewHistoryColCourseSection')}</th>
                      <th className="text-left py-1 pr-2">{translate('testsReviewHistoryColSubject')}</th>
                      <th className="text-left py-1 pr-2">{translate('testsReviewHistoryColTopic')}</th>
                      <th className="text-left py-1 pr-2">{translate('testsReviewHistoryColUploadedAt')}</th>
                      <th className="text-left py-1 pr-2">Ptos</th>
                      <th className="text-left py-1 pr-2">Nota</th>
                      <th className="text-center py-1 pl-2 pr-2">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {test?.sectionId && students.length > 0 ? (
                      // Mostrar una fila por estudiante de la sección, usando su última revisión si existe
                      students.map((s) => {
                        const latest = getLatestReviewForStudent(history, s)
                        const courseLabel = resolveCourseSectionLabel(latest?.courseId ?? (test?.courseId || null), latest?.sectionId ?? (test?.sectionId || null))
                        const subjectLabel = resolveSubjectName(latest?.subjectId ?? (test?.subjectId || null), latest?.subjectName ?? (test?.subjectName || null))
                        const topic = (latest?.topic || test?.topic || '-')
                        return (
                          <tr key={String(s.id)} className="border-t">
                            <td className="py-1 pr-2 truncate">{s.displayName || s.username || '-'}</td>
                            <td className="py-1 pr-2 truncate">{courseLabel}</td>
                            <td className="py-1 pr-2 truncate">{subjectLabel}</td>
                            <td className="py-1 pr-2 truncate">{topic}</td>
                            <td className="py-1 pr-2 truncate">{latest ? formatDateTime(latest.uploadedAt) : '-'}</td>
                            <td className="py-1 pr-2 truncate">
                              {(() => {
                                if (!latest || typeof latest.score !== 'number') return '-'
                                const qTot = typeof latest.totalQuestions === 'number' ? latest.totalQuestions : (test?.questions?.length || 0)
                                const tPts = (history[0]?.totalPoints ?? (test as any)?.totalPoints ?? qTot) as number
                                const pct = qTot > 0 ? Math.min(latest.score, qTot) / qTot : 0
                                const pts = Math.round(pct * (tPts || qTot))
                                return `${pts} pts`
                              })()}
                            </td>
                            <td className="py-1 pr-2 truncate">
                              {(() => {
                                if (!latest || typeof latest.score !== 'number') return '-'
                                const qTot = typeof latest.totalQuestions === 'number' ? latest.totalQuestions : (test?.questions?.length || 0)
                                if (qTot <= 0) return '-'
                                const pct = Math.round((Math.min(latest.score, qTot) / qTot) * 100)
                                return `${pct}%`
                              })()}
                            </td>
                            <td className="py-1 pl-2 pr-2 text-center">
                              {latest ? (
                                editHistTs === latest.uploadedAt ? (
                                  <div className="inline-flex items-center gap-2">
                                    <Input
                                      type="number"
                                      className="h-7 w-24"
                                      value={typeof editHistScore === 'number' ? editHistScore : ''}
                                      min={0}
                                      max={latest?.totalQuestions ?? (test?.questions?.length ?? undefined)}
                                      onChange={(e) => {
                                        const v = e.target.value
                                        if (v === '') return setEditHistScore(null)
                                        const num = Number(v)
                                        if (Number.isNaN(num)) return
                                        const maxPts = latest?.totalQuestions ?? (test?.questions?.length ?? undefined)
                                        const clamped = typeof maxPts === 'number' ? Math.max(0, Math.min(num, maxPts)) : Math.max(0, num)
                                        setEditHistScore(clamped)
                                      }}
                                    />
                                    <Button size="sm" variant="default" onClick={() => {
                                      if (!test?.id || typeof editHistScore !== 'number') return
                                      updateReviewByUploadedAt(test.id, latest.uploadedAt, editHistScore, latest.totalQuestions ?? (test?.questions?.length ?? null))
                                      const key = getReviewKey(test.id)
                                      const raw = localStorage.getItem(key)
                                      if (raw) setHistory(JSON.parse(raw))
                                      setEditHistTs(null); setEditHistScore(null)
                                    }}>Guardar</Button>
                                    <Button size="sm" variant="ghost" onClick={() => { setEditHistTs(null); setEditHistScore(null) }}>Cancelar</Button>
                                  </div>
                                ) : (
                                  <Button size="sm" variant="ghost" onClick={() => { setEditHistTs(latest.uploadedAt); setEditHistScore(latest.score ?? null) }}>✎</Button>
                                )
                              ) : null}
                            </td>
                          </tr>
                        )
                      })
                    ) : (
            history.map((h, idx) => (
                        <tr key={`${h.uploadedAt}-${idx}`} className="border-t">
              <td className="py-1 pr-2 truncate">{h.studentName}</td>
              <td className="py-1 pr-2 truncate">{resolveCourseSectionLabel(h.courseId, h.sectionId)}</td>
              <td className="py-1 pr-2 truncate">{resolveSubjectName(h.subjectId, h.subjectName)}</td>
              <td className="py-1 pr-2 truncate">{h.topic || '-'}</td>
              <td className="py-1 pr-2 truncate">{formatDateTime(h.uploadedAt)}</td>
              <td className="py-1 pr-2 truncate">
                {(() => {
                  if (typeof h.score !== 'number') return '-'
                  const qTot = typeof h.totalQuestions === 'number' ? h.totalQuestions : (test?.questions?.length || 0)
                  const tPts = (h.totalPoints ?? (test as any)?.totalPoints ?? qTot) as number
                  const pct = qTot > 0 ? Math.min(h.score, qTot) / qTot : 0
                  const pts = Math.round(pct * (tPts || qTot))
                  return `${pts} pts`
                })()}
              </td>
                          <td className="py-1 pr-2 truncate">
                {(() => {
                  if (typeof h.score !== 'number') return '-'
                  const qTot = typeof h.totalQuestions === 'number' ? h.totalQuestions : (test?.questions?.length || 0)
                  if (qTot <= 0) return '-'
                  const pct = Math.round((Math.min(h.score, qTot) / qTot) * 100)
                  return `${pct}%`
                })()}
              </td>
                          <td className="py-1 pl-2 pr-2 text-center">
                            {editHistTs === h.uploadedAt ? (
                              <div className="inline-flex items-center gap-2">
                                <Input
                                  type="number"
                                  className="h-7 w-24"
                                  value={typeof editHistScore === 'number' ? editHistScore : ''}
                                  min={0}
                                  max={h.totalQuestions ?? (test?.questions?.length ?? undefined)}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    if (v === '') return setEditHistScore(null)
                                    const num = Number(v)
                                    if (Number.isNaN(num)) return
                                    const maxPts = h.totalQuestions ?? (test?.questions?.length ?? undefined)
                                    const clamped = typeof maxPts === 'number' ? Math.max(0, Math.min(num, maxPts)) : Math.max(0, num)
                                    setEditHistScore(clamped)
                                  }}
                                />
                                <Button size="sm" variant="default" onClick={() => {
                                  if (!test?.id || typeof editHistScore !== 'number') return
                                  updateReviewByUploadedAt(test.id, h.uploadedAt, editHistScore, h.totalQuestions ?? (test?.questions?.length ?? null))
                                  const key = getReviewKey(test.id)
                                  const raw = localStorage.getItem(key)
                                  if (raw) setHistory(JSON.parse(raw))
                                  setEditHistTs(null); setEditHistScore(null)
                                }}>Guardar</Button>
                                <Button size="sm" variant="ghost" onClick={() => { setEditHistTs(null); setEditHistScore(null) }}>Cancelar</Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => { setEditHistTs(h.uploadedAt); setEditHistScore(h.score ?? null) }}>✎</Button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
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
  // Heurísticas mejoradas para formatos comunes en evaluaciones chilenas/latinoamericanas
  const cleaned = text.replace(/[_•◯●○◉◌]+/g, ' ').replace(/\s+/g, ' ')
  
  // 1) Patrones de etiquetas más amplio (incluyendo casos específicos como "NOMBRE DEL ESTUDIANTE:")
  const labelPatterns = [
    /(nombre\s+(?:del\s+|y\s+apellido\s+del\s+)?estudiante|alumno|estudiante|nombre\s+completo)\s*[:\-]?\s*([^\n]+)/i,
    /(nombre|apellido|estudiante)\s*[:\-]\s*([^\n]+)/i,
    /(datos\s+del\s+estudiante|identificación)\s*[:\-]?\s*([^\n]+)/i,
    /(nombre\s+del\s+estudiante)\s*[:\-]?\s*([^\n\r]+)/i,
    /(estudiante)\s*[:\-]?\s*([^\n\r]+)/i
  ]
  
  for (const pattern of labelPatterns) {
    const match = cleaned.match(pattern)
    if (match?.[2]) {
      const candidate = match[2]
        .replace(/[_–—-]{2,}/g, ' ') // líneas de guiones
        .replace(/\.{3,}/g, ' ') // puntos suspensivos
        .replace(/\s+/g, ' ')
        .trim()
      
      // Filtrar texto que no parece nombre
      if (candidate && !/^[\d\s\-_\.]+$/.test(candidate) && candidate.length > 2) {
        const tokens = candidate.split(/\s+/).filter(token => 
          token.length > 1 && 
          !/^[\d\-_\.]+$/.test(token) &&
          !/^(rut|run|curso|sección|fecha|página|hoja)$/i.test(token)
        )
        if (tokens.length >= 2) return tokens.slice(0, 3).join(' ')
        if (tokens.length === 1 && tokens[0].length > 2) return tokens[0]
      }
    }
  }
  
  // 2) Buscar específicamente después de etiquetas en líneas separadas
  const lines = text.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean)
  for (let i = 0; i < Math.min(lines.length, 25); i++) {
    const currentLine = lines[i]
    
    // Detectar líneas con etiquetas de nombre
    if (/(?:nombre|estudiante|alumno|datos)(?:\s+(?:del\s+)?(?:estudiante|alumno))?/i.test(currentLine)) {
      // Buscar en las próximas 5 líneas
      for (let j = i + 1; j <= Math.min(i + 5, lines.length - 1); j++) {
        const nextLine = lines[j]
        const candidate = nextLine
          .replace(/[_–—-]{2,}/g, ' ')
          .replace(/\.{3,}/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        
        // Validar que parece un nombre
        if (candidate && 
            candidate.length > 2 && 
            candidate.length < 50 &&
            !/^[\d\s\-_\.]+$/.test(candidate) &&
            !/(?:rut|run|curso|sección|fecha|página|hoja|asignatura|ciencias|sistema|respiratorio|clave)/i.test(candidate)) {
          const tokens = candidate.split(/\s+/).filter(token => 
            token.length > 1 && 
            !/^[\d\-_\.]+$/.test(token) &&
            !/^(el|la|los|las|de|del|y|o|en|con|por|para)$/i.test(token)
          )
          if (tokens.length >= 1) return tokens.slice(0, 3).join(' ')
        }
      }
    }
  }
  
  // 3) Buscar nombres standalone en las primeras líneas (casos como "Sofia" solo)
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const line = lines[i].trim()
    
    // Permitir nombres simples de 3+ caracteres que no sean palabras comunes
    if (line.length >= 3 && 
        line.length <= 30 &&
        /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ']*(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ']*){0,3}$/.test(line) &&
        !/(?:curso|sección|fecha|asignatura|página|hoja|universidad|colegio|liceo|sistema|respiratorio|clave|ciencias|naturales|básico|temas)/i.test(line) &&
        !/^(el|la|los|las|de|del|y|o|en|con|por|para|que|como|este|esta|año|mes|día)$/i.test(line)) {
      
      // Verificar que no es parte de un título o encabezado
      const prevLine = i > 0 ? lines[i - 1] : ''
      const nextLine = i < lines.length - 1 ? lines[i + 1] : ''
      
      if (!(/(?:sistema|respiratorio|clave|ciencias|asignatura|curso)/i.test(prevLine) ||
            /(?:sistema|respiratorio|clave|ciencias|asignatura|curso)/i.test(nextLine))) {
        return line
      }
    }
  }
  
  // 4) Buscar patrones tipo "Apellido, Nombre"
  const commaPattern = /([A-ZÁÉÍÓÚÑ][a-záéíóúñ']+)\s*,\s*([A-ZÁÉÍÓÚÑ][a-záéíóúñ']+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ']*)?)/
  const commaMatch = text.match(commaPattern)
  if (commaMatch) {
    return `${commaMatch[2]} ${commaMatch[1]}`.trim()
  }
  
  // 5) Última búsqueda: nombres en contexto específico de pruebas
  for (const line of lines.slice(0, 15)) {
    // Buscar líneas que contengan solo un nombre después de información del curso
    if (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}$/.test(line.trim()) &&
        !(/(?:sistema|respiratorio|clave|ciencias|básico|naturales)/i.test(line))) {
      return line.trim()
    }
  }
  
  return ''
}

function autoGrade(text: string, questions: AnyQuestion[]): number {
  if (!questions?.length) return 0
  
  // Normalizar texto para buscar marcas y opciones
  const raw = text
  const norm = normalize(text)
  const lines = raw.split(/\n+/)
  
  // Patrones mejorados para detectar marcas seleccionadas
  const isSelectedMark = (s: string) => {
    // Detectar múltiples formatos de marcas
    const patterns = [
      /[\[\(]\s*[xX✓✔●◉•]\s*[\]\)]/,  // (x), [✓], etc.
      /\b[xX✓✔●◉•]\b/,                  // x, ✓ standalone
      /\([xX✓✔●◉•]\)/,                 // (x)
      /\[[xX✓✔●◉•]\]/,                 // [x]
      /{[xX✓✔●◉•]}/,                   // {x}
      /\*[xX✓✔●◉•]\*/,                 // *x*
      /\b[xX✓✔●◉•]\s*(?=\s|$)/,       // x seguido de espacio o fin
    ]
    return patterns.some(pattern => pattern.test(s))
  }
  
  const optionLabel = (idx: number) => String.fromCharCode(65 + idx) // A, B, C, D...
  
  // Detector mejorado de letras de opción
  const hasOptionLabel = (line: string, label: string) => {
    if (!line || !label) return false
    const upper = line.toUpperCase()
    const L = label.toUpperCase()
    
    // Patrones múltiples para encontrar etiquetas
    const patterns = [
      new RegExp(`\\b${L}\\s*[\\)\\]\\.]`, 'g'),  // A) A] A.
      new RegExp(`\\(${L}\\)`, 'g'),              // (A)
      new RegExp(`\\[${L}\\]`, 'g'),              // [A]
      new RegExp(`^\\s*${L}\\s*[\\-:]`, 'g'),    // A- A:
      new RegExp(`\\b${L}\\b`, 'g'),              // A standalone
    ]
    
    return patterns.some(pattern => pattern.test(upper))
  }
  
  // Función para buscar texto de opción en contexto
  const findOptionInContext = (optionText: string, searchRadius = 2) => {
    const normalizedOption = normalize(optionText)
    if (normalizedOption.length < 5) return false
    
    // Buscar el texto de la opción y verificar marcas cercanas
    for (let i = 0; i < lines.length; i++) {
      const currentLine = normalize(lines[i])
      if (currentLine.includes(normalizedOption.slice(0, Math.min(20, normalizedOption.length)))) {
        // Buscar marcas en líneas cercanas
        for (let j = Math.max(0, i - searchRadius); j <= Math.min(lines.length - 1, i + searchRadius); j++) {
          if (isSelectedMark(lines[j])) {
            return true
          }
        }
      }
    }
    return false
  }

  let correct = 0
  
  for (const q of questions) {
    if ((q as any).type === 'tf') {
      const tf = q as QuestionTF
      
      // Buscar patrones V/F específicos para el formato de la imagen
      let vSelected = false
      let fSelected = false
      
      for (const line of lines) {
        const normalLine = normalize(line)
        const originalLine = line
        
        // Patrones específicos como "V ( X )" o "V(X)" - detectar X dentro de paréntesis después de V
        const vPatterns = [
          /v\s*\(\s*[xX✓✔●◉•]\s*\)/i,           // V(X), V( X ), etc.
          /v\s*\[\s*[xX✓✔●◉•]\s*\]/i,           // V[X]
          /v\s*[xX✓✔●◉•]/i,                     // V X (sin paréntesis)
          /(verdadero)\s*[\(\[]?\s*[xX✓✔●◉•]\s*[\)\]]?/i  // Verdadero marcado
        ]
        
        const fPatterns = [
          /f\s*\(\s*[xX✓✔●◉•]\s*\)/i,           // F(X), F( X ), etc.
          /f\s*\[\s*[xX✓✔●◉•]\s*\]/i,           // F[X]
          /f\s*[xX✓✔●◉•]/i,                     // F X (sin paréntesis)
          /(falso)\s*[\(\[]?\s*[xX✓✔●◉•]\s*[\)\]]?/i      // Falso marcado
        ]
        
        // Verificar patrones V
        if (vPatterns.some(pattern => pattern.test(originalLine))) {
          vSelected = true
        }
        
        // Verificar patrones F
        if (fPatterns.some(pattern => pattern.test(originalLine))) {
          fSelected = true
        }
        
        // Patrón especial: detectar líneas como "V ( ) F ( X )" donde solo una opción está marcada
        const combinedVF = /v\s*\(\s*([xX✓✔●◉•\s]*)\s*\)\s*f\s*\(\s*([xX✓✔●◉•\s]*)\s*\)/i
        const combinedMatch = originalLine.match(combinedVF)
        if (combinedMatch) {
          const vMark = combinedMatch[1].trim()
          const fMark = combinedMatch[2].trim()
          if (vMark && /[xX✓✔●◉•]/.test(vMark)) vSelected = true
          if (fMark && /[xX✓✔●◉•]/.test(fMark)) fSelected = true
        }
        
        // Patrón inverso: "F ( ) V ( X )"
        const combinedFV = /f\s*\(\s*([xX✓✔●◉•\s]*)\s*\)\s*v\s*\(\s*([xX✓✔●◉•\s]*)\s*\)/i
        const combinedFVMatch = originalLine.match(combinedFV)
        if (combinedFVMatch) {
          const fMark = combinedFVMatch[1].trim()
          const vMark = combinedFVMatch[2].trim()
          if (fMark && /[xX✓✔●◉•]/.test(fMark)) fSelected = true
          if (vMark && /[xX✓✔●◉•]/.test(vMark)) vSelected = true
        }
      }
      
      // Debug logging para V/F
      console.log(`[TF Debug] Pregunta: "${tf.text.slice(0, 50)}...", Respuesta correcta: ${tf.answer ? 'V' : 'F'}, V seleccionada: ${vSelected}, F seleccionada: ${fSelected}`)
      
      // Validar respuesta: solo otorgar punto si exactamente una opción está seleccionada y es la correcta
      if ((tf.answer && vSelected && !fSelected) || (!tf.answer && fSelected && !vSelected)) {
        correct++
        console.log(`[TF] ✅ Respuesta correcta`)
      } else {
        console.log(`[TF] ❌ Respuesta incorrecta o ambigua`)
      }
      continue
    }
    
    if ((q as any).type === 'mc') {
      const mc = q as QuestionMC
      const correctIdx = mc.correctIndex
      const correctText = mc.options[correctIdx]
      const label = optionLabel(correctIdx)
      
      let isCorrect = false
      let debugInfo = {
        foundByLabel: false,
        foundByContext: false,
        foundByText: false
      }
      
      // 1) Buscar por letra con marca
      for (const line of lines) {
        if (hasOptionLabel(line, label) && isSelectedMark(line)) {
          isCorrect = true
          debugInfo.foundByLabel = true
          break
        }
      }
      
      // 2) Buscar por texto de opción con marca cercana
      if (!isCorrect) {
        isCorrect = findOptionInContext(correctText)
        if (isCorrect) debugInfo.foundByContext = true
      }
      
      // 3) Fallback: texto de opción exacto con marca en la misma línea
      if (!isCorrect) {
        const escapedText = correctText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const textPattern = new RegExp(escapedText, 'i')
        for (const line of lines) {
          if (textPattern.test(line) && isSelectedMark(line)) {
            isCorrect = true
            debugInfo.foundByText = true
            break
          }
        }
      }
      
      // Debug logging
      console.log(`[MC Debug] Pregunta: "${mc.text.slice(0, 50)}...", Opción correcta: ${label} - "${correctText}", Encontrada: ${isCorrect}`, debugInfo)
      
      if (isCorrect) {
        correct++
        console.log(`[MC] ✅ Respuesta correcta`)
      } else {
        console.log(`[MC] ❌ Respuesta no detectada`)
      }
      continue
    }
    
    if ((q as any).type === 'ms') {
      const ms = q as QuestionMS
      const correctOptions = ms.options.filter(o => o.correct)
      let correctSelections = 0
      let incorrectSelections = 0
      
      // Verificar cada opción
      for (let i = 0; i < ms.options.length; i++) {
        const option = ms.options[i]
        const label = optionLabel(i)
        let isSelected = false
        
        // Buscar por letra con marca
        for (const line of lines) {
          if (hasOptionLabel(line, label) && isSelectedMark(line)) {
            isSelected = true
            break
          }
        }
        
        // Buscar por texto con marca cercana
        if (!isSelected) {
          isSelected = findOptionInContext(option.text)
        }
        
        // Contar correctas e incorrectas
        if (isSelected) {
          if (option.correct) {
            correctSelections++
          } else {
            incorrectSelections++
          }
        }
      }
      
      // Otorgar punto solo si todas las correctas están seleccionadas y ninguna incorrecta
      if (correctSelections === correctOptions.length && incorrectSelections === 0) {
        correct++
      }
      continue
    }
    
    // Para preguntas de desarrollo, no auto-calificar (requiere revisión manual)
    if ((q as any).type === 'des') {
      // Las preguntas de desarrollo se califican manualmente
      continue
    }
  }
  
  return correct
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
  totalQuestions: number | null
  totalPoints?: number | null
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

function updateReviewByUploadedAt(testId: string, uploadedAt: number, newScore: number, totalQuestions: number | null) {
  try {
    const key = getReviewKey(testId)
    const list: ReviewRecord[] = JSON.parse(localStorage.getItem(key) || '[]')
    const idx = list.findIndex(r => r.uploadedAt === uploadedAt)
    if (idx >= 0) {
      list[idx] = { ...list[idx], score: newScore, totalQuestions }
      localStorage.setItem(key, JSON.stringify(list))
      try { window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(list) })) } catch {}
      return true
    }
    return false
  } catch {
    return false
  }
}

function updateLatestReviewScore(params: { testId: string, studentId: string, studentName: string, newScore: number, totalQuestions: number | null }) {
  try {
    const key = getReviewKey(params.testId)
    const list: ReviewRecord[] = JSON.parse(localStorage.getItem(key) || '[]')
    if (!Array.isArray(list) || list.length === 0) return
    // Buscar el último registro del estudiante por nombre o id
    let idx = list.findIndex(r => (r.studentId && String(r.studentId) === String(params.studentId)))
    if (idx < 0) {
      const target = normalize(params.studentName)
      idx = list.findIndex(r => normalize(r.studentName) === target)
    }
    if (idx >= 0) {
      list[idx] = { ...list[idx], score: params.newScore, totalQuestions: params.totalQuestions }
      localStorage.setItem(key, JSON.stringify(list))
      try { window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(list) })) } catch {}
    }
  } catch (e) {
    console.warn('[TestReview] No se pudo actualizar la nota en historial:', e)
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

// ===== Persistencia de notas por prueba/estudiante =====

type TestGrade = {
  id: string // compuesto testId-studentId
  testId: string
  studentId: string
  studentName: string
  score: number
  courseId: string | null
  sectionId: string | null
  subjectId: string | null
  title?: string
  gradedAt: number
}

function upsertTestGrade(input: { testId: string; studentId: string; studentName: string; score: number; courseId: string | null; sectionId: string | null; subjectId: string | null; title?: string }) {
  const key = 'smart-student-test-grades'
  const id = `${input.testId}-${input.studentId}`
  try {
    const list: TestGrade[] = JSON.parse(localStorage.getItem(key) || '[]')
    const idx = list.findIndex(g => g.id === id)
    const rec: TestGrade = {
      id,
      testId: input.testId,
      studentId: input.studentId,
      studentName: input.studentName,
      score: Math.max(0, Math.min(100, Math.round(input.score))),
      courseId: input.courseId,
      sectionId: input.sectionId,
      subjectId: input.subjectId,
      title: input.title,
      gradedAt: Date.now(),
    }
    if (idx >= 0) list[idx] = rec; else list.push(rec)
    localStorage.setItem(key, JSON.stringify(list))
    try { window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(list) })) } catch {}
  } catch (e) {
    console.warn('[TestReview] upsertTestGrade error:', e)
  }
}

// ===== Heurística: extraer nombre desde nombre de archivo =====
function guessStudentNameFromFilename(filename: string): string {
  try {
    // Remover extensión
    const base = filename.replace(/\.[a-zA-Z0-9]+$/, '')
    // Separar por delimitadores comunes
    const parts = base.split(/[\s_.\-()]+/).filter(Boolean)
    // Ignorar palabras comunes del contexto escolar
    const ignore = new Set(['sistema','respiratorio','clave','ciencias','naturales','basico','básico','asignatura','tema','curso','seccion','sección','guia','prueba','test','evaluacion','evaluación','nombre','estudiante'])
    // Buscar tokens que parecen nombres propios (capitalizados y alfabéticos)
    const candidates = parts.filter(p => /^[A-Za-zÁÉÍÓÚÑáéíóúñ]+$/.test(p) && p.length >= 3 && !ignore.has(p.toLowerCase()))
    if (candidates.length === 0) return ''
    // Unir hasta 2-3 tokens si existen
    const pick = candidates.slice(-2).join(' ')
    // Capitalizar correctamente
    return pick.replace(/\b([a-záéíóúñ])/g, (m) => m.toUpperCase())
  } catch {
    return ''
  }
}

function verifySameDocument(ocrText: string, questions: AnyQuestion[]) {
  if (!questions?.length) return { isMatch: false, coverage: 0 }
  
  const text = normalize(ocrText)
  let matched = 0
  let checked = 0
  
  for (const q of questions) {
    let stem = ''
    let options: string[] = []
    
    if ((q as any).type === 'tf' || (q as any).type === 'mc' || (q as any).type === 'ms') {
      stem = normalize((q as any).text || '')
      if ((q as any).type === 'mc') {
        options = ((q as any).options || []).map((opt: string) => normalize(opt))
      }
      if ((q as any).type === 'ms') {
        options = (((q as any).options || []) as Array<{text: string}>).map(opt => normalize(opt.text || ''))
      }
    } else if ((q as any).type === 'des') {
      stem = normalize((q as any).prompt || '')
    }
    
    if (!stem || stem.length < 8) continue // ignorar stems muy cortos
    checked++
    
    // Estrategias múltiples para matching más robusto
    let foundMatch = false
    
    // 1) Match exacto de fragmento inicial (más largo para mayor precisión)
    const fragment = stem.slice(0, Math.min(60, stem.length))
    if (text.includes(fragment)) {
      foundMatch = true
    }
    
    // 2) Match por fragmentos más cortos si el fragmento largo no funciona
    if (!foundMatch && stem.length > 20) {
      const shortFragment = stem.slice(0, 20)
      if (text.includes(shortFragment)) {
        foundMatch = true
      }
    }
    
    // 3) Match por palabras clave significativas (tolerante a errores OCR)
    if (!foundMatch) {
      const keywords = stem.split(/\s+/)
        .filter(word => word.length > 4) // palabras significativas
        .filter(word => !['sobre', 'para', 'desde', 'hasta', 'como', 'entre', 'durante', 'mediante', 'según', 'respecto', 'acerca', 'sistema', 'que', 'cual', 'cuando', 'donde'].includes(word))
      
      if (keywords.length > 0) {
        const keywordMatches = keywords.filter(keyword => {
          // Buscar palabra exacta o variaciones OCR comunes
          return text.includes(keyword) || 
                 text.includes(keyword.replace(/o/g, '0')) || // o -> 0
                 text.includes(keyword.replace(/i/g, '1')) || // i -> 1
                 text.includes(keyword.replace(/s/g, '5'))    // s -> 5
        }).length
        const keywordRatio = keywordMatches / keywords.length
        if (keywordRatio >= 0.5) { // 50% de palabras clave encontradas
          foundMatch = true
        }
      }
    }
    
    // 4) Para MC y MS: verificar si las opciones están presentes
    if (!foundMatch && options.length > 0) {
      const optionMatches = options.filter(opt => {
        if (opt.length < 5) return false
        const optFragment = opt.slice(0, Math.min(25, opt.length))
        return text.includes(optFragment) || 
               text.includes(optFragment.replace(/o/g, '0')) ||
               text.includes(optFragment.replace(/i/g, '1'))
      }).length
      
      // Si al menos 50% de las opciones están presentes
      if (optionMatches >= Math.max(1, Math.ceil(options.length * 0.5))) {
        foundMatch = true
      }
    }
    
    // 5) Match fuzzy con tolerancia alta para caracteres similares
    if (!foundMatch) {
      // Crear versión fuzzy reemplazando caracteres comúnmente confundidos por OCR
      const fuzzyStem = stem
        .replace(/[aeiouáéíóú]/g, '.') // vocales con comodín
        .replace(/[0o]/g, '[0o]')      // 0 y o intercambiables
        .replace(/[1li]/g, '[1li]')    // 1, l, i intercambiables
        .replace(/[5s]/g, '[5s]')      // 5 y s intercambiables
        .slice(0, 30) // limitar longitud para evitar regex muy complejos
      
      try {
        const fuzzyRegex = new RegExp(fuzzyStem, 'i')
        if (fuzzyRegex.test(text)) {
          foundMatch = true
        }
      } catch (e) {
        // Si el regex falla, intentar match simple por partes
        const words = stem.split(/\s+/).slice(0, 3) // primeras 3 palabras
        const wordMatches = words.filter(word => 
          word.length > 3 && text.includes(word)
        ).length
        if (wordMatches >= Math.max(1, Math.ceil(words.length * 0.6))) {
          foundMatch = true
        }
      }
    }
    
    // 6) Para preguntas de Verdadero/Falso, buscar patrones específicos
    if (!foundMatch && (q as any).type === 'tf') {
      const tfIndicators = ['verdadero', 'falso', 'v()', 'f()', 'correcto', 'incorrecto']
      if (tfIndicators.some(indicator => text.includes(indicator))) {
        // Si encontramos indicadores de V/F, es muy probable que sea la misma prueba
        foundMatch = true
      }
    }
    
    if (foundMatch) matched++
  }
  
  const coverage = checked > 0 ? matched / checked : 0
  // Umbral aún más flexible: 20% para documentos con mucho ruido OCR
  const isMatch = coverage >= 0.2
  
  console.log(`[Verificación] Preguntas verificadas: ${checked}, Coincidencias: ${matched}, Cobertura: ${Math.round(coverage * 100)}%`)
  
  return { isMatch, coverage }
}

function similarityByTokens(a: string, b: string) {
  const A = new Set(normalize(a).split(/\s+/).filter(Boolean))
  const B = new Set(normalize(b).split(/\s+/).filter(Boolean))
  if (A.size === 0 || B.size === 0) return 0
  let inter = 0
  for (const t of A) if (B.has(t)) inter++
  const union = A.size + B.size - inter
  return inter / union
}

function findStudentInSection(guessedName: string, courseId?: string | null, sectionId?: string | null) {
  try {
    if (!sectionId) return null
    const users = JSON.parse(localStorage.getItem('smart-student-users') || '[]') as any[]
    const assignments = JSON.parse(localStorage.getItem('smart-student-student-assignments') || '[]') as any[]
    const target = normalize(guessedName)
    const ids = new Set(
      assignments
        .filter(a => String(a.sectionId) === String(sectionId))
        .map(a => String(a.studentId || a.studentUsername))
    )
    const list = users.filter(u => (u.role === 'student' || u.role === 'estudiante') && (ids.has(String(u.id)) || ids.has(String(u.username))))
    // 1) match directo por inclusión
    for (const u of list) {
      const dn = normalize(u.displayName || '')
      const un = normalize(u.username || '')
      if (!target) continue
      if ((dn && (dn.includes(target) || target.includes(dn))) || (un && un === target)) return u
    }
    // 2) fuzzy por tokens si no hubo match directo
    let best: any = null
    let bestScore = 0
    for (const u of list) {
      const dn = normalize(u.displayName || '')
      const s = similarityByTokens(target, dn)
      if (s > bestScore) { bestScore = s; best = u }
    }
    if (best && bestScore >= 0.5) return best
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

function getLatestReviewForStudent(history: ReviewRecord[], student: any): ReviewRecord | null {
  try {
    if (!history?.length) return null
    const sid = String(student.id ?? student.username ?? '')
    const dn = normalize(student.displayName || '')
    const un = normalize(student.username || '')

    // 1) Coincidencia por studentId exacto si está disponible en el historial
    const byId = history.filter(h => h.studentId && String(h.studentId) === sid)
    if (byId.length) return byId.sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0))[0]

    // 2) Fallback: coincidencia por nombre/token
    const matches = history.filter(h => {
      const hs = normalize(h.studentName || '')
      return (dn && (hs.includes(dn) || dn.includes(hs))) || (un && hs === un)
    })
    if (!matches.length) return null
    return matches.sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0))[0]
  } catch {
    return null
  }
}
