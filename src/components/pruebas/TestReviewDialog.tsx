"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type QuestionTF = { id: string; type: "tf"; text: string; answer: boolean; explanation?: string }
type QuestionMC = { id: string; type: "mc"; text: string; options: string[]; correctIndex: number }
type QuestionMS = { id: string; type: "ms"; text: string; options: Array<{ text: string; correct: boolean }> }
type QuestionDES = { id: string; type: "des"; prompt: string; sampleAnswer?: string }
type AnyQuestion = QuestionTF | QuestionMC | QuestionMS | QuestionDES

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  test?: { id: string; title: string; description?: string; questions?: AnyQuestion[] }
}

type OCRResult = {
  text: string
  confidence?: number
}

export default function TestReviewDialog({ open, onOpenChange, test }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [ocr, setOcr] = useState<OCRResult | null>(null)
  const [processing, setProcessing] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [studentName, setStudentName] = useState<string>("")
  const [error, setError] = useState<string>("")
  const workerRef = useRef<any>(null)

  useEffect(() => {
    if (!open) {
      // reset al cerrar
      setFile(null)
      setOcr(null)
      setProcessing(false)
      setScore(null)
      setStudentName("")
      setError("")
    }
  }, [open])

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
      const computed = autoGrade(text, test?.questions || [])
      setScore(computed)
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
          <DialogTitle>Revisar: {test?.title || "Prueba"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input type="file" accept="image/*,application/pdf" onChange={handleFile} />
          <div className="flex gap-2">
            <Button onClick={runOCR} disabled={!file || processing}>
              {processing ? "Procesando..." : "Ejecutar OCR"}
            </Button>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          {ocr && (
            <div className="border rounded-md p-3 space-y-2">
              <div className="text-sm">
                <span className="font-medium">Estudiante:</span> {studentName || "No detectado"}
              </div>
              <div className="text-sm">
                <span className="font-medium">Puntaje:</span> {score ?? "-"}
              </div>
              <details className="text-xs text-muted-foreground">
                <summary>Texto OCR</summary>
                <pre className="whitespace-pre-wrap">{ocr.text}</pre>
              </details>
            </div>
          )}
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
