"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import { useLanguage } from "@/contexts/language-context"

type Student = { id: string; name: string; rut?: string; email?: string }

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  test?: {
    id: string
    title: string
    description?: string
    createdAt?: number
    sectionId?: string
    courseId?: string
    subjectId?: string
  subjectName?: string
    topic?: string
    counts?: { tf: number; mc: number; ms: number; des?: number }
    questions?: AnyQuestion[]
  }
  onReview?: () => void
}

const STUDENTS_KEY = "smart-student-students"
const COURSE_SECTION_KEY = "smart-student-current-course-section"
const SECTIONS_KEY = "smart-student-sections"
const COURSES_KEY = "smart-student-courses"
const SUBJECTS_KEY = "smart-student-subjects"

type QuestionTF = { id: string; type: "tf"; text: string; answer: boolean; explanation?: string }
type QuestionMC = { id: string; type: "mc"; text: string; options: string[]; correctIndex: number }
type QuestionMS = { id: string; type: "ms"; text: string; options: Array<{ text: string; correct: boolean }> }
type QuestionDES = { id: string; type: "des"; prompt: string; sampleAnswer?: string }
type AnyQuestion = QuestionTF | QuestionMC | QuestionMS | QuestionDES

export default function TestViewDialog({ open, onOpenChange, test, onReview }: Props) {
  const { translate } = useLanguage()
  const [students, setStudents] = useState<Student[]>([])
  const [courseSectionName, setCourseSectionName] = useState<string>("")
  const [courseName, setCourseName] = useState<string>("")
  const [subjectName, setSubjectName] = useState<string>("")
  const [sectionId, setSectionId] = useState<string>("")
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    try {
      const rawS = localStorage.getItem(STUDENTS_KEY)
      const list: Student[] = rawS ? JSON.parse(rawS) : []
      setStudents(list)
    } catch (e) {
      console.error("[TestViewDialog] Error leyendo estudiantes", e)
    }
    try {
      // Preferir el nombre real de la sección guardada
      const rawSecs = localStorage.getItem(SECTIONS_KEY)
      const secs = rawSecs ? JSON.parse(rawSecs) : []
  const cs = JSON.parse(localStorage.getItem(COURSES_KEY) || "[]")
  const sb = JSON.parse(localStorage.getItem(SUBJECTS_KEY) || "[]")
      if (test?.sectionId) {
        setSectionId(String(test.sectionId))
        const sec = secs.find((s: any) => String(s.id) === String(test.sectionId))
        if (sec) setCourseSectionName(sec.name || "Curso/Sección")
        const course = cs.find((c: any) => String(c.id) === String(sec?.courseId))
        if (course?.name) setCourseName(course.name)
  let subj = sb.find((x: any) => String(x.id) === String(test.subjectId))
  if (!subj) subj = sb.find((x: any) => String(x.name) === String(test.subjectId))
  if (subj?.name) setSubjectName(subj.name)
  else if (test?.subjectName) setSubjectName(test.subjectName)
  else if (test?.subjectId) setSubjectName(String(test.subjectId))
      } else {
        const rawCS = localStorage.getItem(COURSE_SECTION_KEY)
        if (rawCS) {
          const parsed = JSON.parse(rawCS)
          setCourseSectionName(parsed?.name || parsed?.label || "Curso/Sección")
          setSectionId(parsed?.id || parsed?.sectionId || "")
        }
      }
    } catch (e) {
      // ignore
    }
  }, [open])

  const filtered = useMemo(() => {
    if (!sectionId) return students
    // Filtrar estudiantes que pertenezcan a la sección
    return students.filter((s: any) => String(s.sectionId || s.section) === String(sectionId))
  }, [students, sectionId])

  // Fallback local: generar preguntas si no existen para evitar PDF vacío
  const questions: AnyQuestion[] = useMemo(() => {
    if (test?.questions && test.questions.length > 0) return test.questions
    const counts = test?.counts || { tf: 1, mc: 1, ms: 1, des: 1 }
    const topic = test?.topic || "Tema"
    const makeId = (p: string) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
    const cleanTopic = topic.trim()
    const out: AnyQuestion[] = []
    for (let i = 0; i < (counts.tf || 0); i++) {
      const positive = Math.random() > 0.5
      const text = positive
        ? `${cap(cleanTopic)}: la afirmación ${i + 1} es correcta según lo visto en clase.`
        : `${cap(cleanTopic)}: la afirmación ${i + 1} es incorrecta de acuerdo al contenido.`
      out.push({ id: makeId("tf"), type: "tf", text, answer: positive })
    }
    for (let i = 0; i < (counts.mc || 0); i++) {
      const stem = `Sobre ${cleanTopic}, seleccione la alternativa correcta (ítem ${i + 1}).`
      const distractors = [
        `Enfoque no asociado directamente a ${cleanTopic}.`,
        `Aplicación parcial de ${cleanTopic}.`,
        `Caso límite de ${cleanTopic}.`,
      ]
      const correct = `Definición o ejemplo preciso de ${cleanTopic}.`
      const options = [...distractors]
      const idx = Math.floor(Math.random() * (options.length + 1))
      options.splice(idx, 0, correct)
      out.push({ id: makeId("mc"), type: "mc", text: stem, options, correctIndex: idx })
    }
    for (let i = 0; i < (counts.ms || 0); i++) {
      const stem = `Marque todas las opciones que corresponden a ${cleanTopic} (ítem ${i + 1}).`
      const base = [
        { text: `Propiedad clave de ${cleanTopic}.`, correct: true },
        { text: `Característica secundaria de ${cleanTopic}.`, correct: true },
        { text: `Idea común pero no esencial de ${cleanTopic}.`, correct: false },
        { text: `Concepto no relacionado con ${cleanTopic}.`, correct: false },
      ]
      const shuffled = [...base].sort(() => Math.random() - 0.5)
      out.push({ id: makeId("ms"), type: "ms", text: stem, options: shuffled })
    }
    for (let i = 0; i < (counts.des || 0); i++) {
      const prompt = `Desarrolle y justifique con sus palabras un análisis sobre ${cleanTopic} (ítem ${i + 1}).`
      out.push({ id: makeId("des"), type: "des", prompt })
    }
    return out
  }, [test?.questions, test?.counts, test?.topic])

  const handleExportPDF = async () => {
    const node = contentRef.current
    if (!node) return
    const canvas = await html2canvas(node, { scale: 2, useCORS: true })
    const imgData = canvas.toDataURL("image/png")
    const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" })

    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()

    const imgWidth = pageWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    let position = 0
    let remaining = imgHeight

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight)
    remaining -= pageHeight
    while (remaining > 0) {
      pdf.addPage()
      position = - (imgHeight - remaining)
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight)
      remaining -= pageHeight
    }
    const filename = `${test?.title || "prueba"}-${courseSectionName || "curso"}.pdf`
    pdf.save(filename)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Limitar alto y permitir desplazamiento para pruebas largas */}
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vista: {test?.title || "Prueba"}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm text-muted-foreground">{courseName ? `${courseName} ${courseSectionName}` : courseSectionName}</div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleExportPDF}
              className="border-fuchsia-200 text-fuchsia-800 hover:bg-fuchsia-600 hover:text-white dark:border-fuchsia-800"
            >
              Descargar
            </Button>
          </div>
        </div>

        {/* Contenido imprimible de la prueba */}
        <div ref={contentRef} className="mt-3 border rounded-md p-6 space-y-4">
          {/* Encabezado de la prueba */}
          <div className="space-y-1">
            <div className="text-center">
              <h2 className="text-lg font-semibold">{test?.title || "Prueba"}</h2>
            </div>
            {/* Orden: Tema, Fecha y hora, Curso, Asignatura */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="font-medium">{translate('testsLabelTopic')}:</span> {test?.topic || "-"}</div>
              <div><span className="font-medium">{translate('testsLabelDateTime')}:</span> {test?.createdAt ? new Date(test.createdAt).toLocaleString() : new Date().toLocaleString()}</div>
              <div><span className="font-medium">{translate('testsLabelCourseSection')}:</span> {courseName ? `${courseName} ${courseSectionName}` : courseSectionName}</div>
              <div><span className="font-medium">{translate('testsLabelSubject')}:</span> {subjectName || "-"}</div>
            </div>
            <div className="mt-2 text-sm"><span className="font-medium">{translate('testsLabelStudentName')}:</span> ________________________________</div>
          </div>

          {/* Preguntas */}
          <div className="space-y-4">
            {(test?.questions || []).map((q, idx) => {
              const num = idx + 1
              if ((q as any).type === "tf") {
                const qt = q as QuestionTF
                return (
                  <div key={q.id} className="text-sm">
                    <div className="font-medium">{num}. {qt.text}</div>
                    <div className="mt-1">V (  )   F (  )</div>
                  </div>
                )
              }
              if ((q as any).type === "mc") {
                const qm = q as QuestionMC
                const letters = ["A", "B", "C", "D", "E", "F"]
                return (
                  <div key={q.id} className="text-sm">
                    <div className="font-medium">{num}. {qm.text}</div>
                    <ul className="mt-1 space-y-1">
                      {qm.options.map((opt, i) => (
                        <li key={i}>
                          ({letters[i] || String(i + 1)}) {opt}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              }
              if ((q as any).type === "ms") {
                const qs = q as QuestionMS
                const letters = ["A", "B", "C", "D", "E", "F"]
                return (
                  <div key={q.id} className="text-sm">
                    <div className="font-medium">{num}. {qs.text}</div>
                    <ul className="mt-1 space-y-1">
                      {qs.options.map((opt, i) => (
                        <li key={i}>
                          <input type="checkbox" className="mr-2" />({letters[i] || String(i + 1)}) {opt.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              }
              // Desarrollo
              const qd = q as QuestionDES
              return (
                <div key={q.id} className="text-sm">
                  <div className="font-medium">{num}. {qd.prompt}</div>
                  <div className="mt-2 h-24 border rounded" />
                </div>
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
