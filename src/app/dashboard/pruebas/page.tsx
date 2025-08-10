"use client"

import React, { useEffect, useMemo, useState } from "react"
import { Plus, Eye, ClipboardCheck, FileSearch, Pencil, Trash2 } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"

import { Button } from "@/components/ui/button"
import TestViewDialog from "@/components/pruebas/TestViewDialog"
import TestReviewDialog from "@/components/pruebas/TestReviewDialog"
import TestBuilder from "@/components/pruebas/TestBuilder"

type QuestionTF = { id: string; type: "tf"; text: string; answer: boolean; explanation?: string }
type QuestionMC = { id: string; type: "mc"; text: string; options: string[]; correctIndex: number }
type QuestionMS = { id: string; type: "ms"; text: string; options: Array<{ text: string; correct: boolean }> }
type QuestionDES = { id: string; type: "des"; prompt: string; sampleAnswer?: string }
type AnyQuestion = QuestionTF | QuestionMC | QuestionMS | QuestionDES

type TestItem = {
	id: string
	title: string
	description?: string
	createdAt: number
	courseId?: string
	sectionId?: string
	subjectId?: string
	// Guardamos también el nombre para mostrarlo aunque falte el dataset en localStorage
	subjectName?: string
	topic?: string
	counts?: { tf: number; mc: number; ms: number; des?: number }
	total?: number
	questions?: AnyQuestion[]
}

const TESTS_KEY = "smart-student-tests"

export default function PruebasPage() {
	const { translate } = useLanguage()
	const [tests, setTests] = useState<TestItem[]>([])
		const [newTitle, setNewTitle] = useState("")
		const [builder, setBuilder] = useState<any>({})
	const [selected, setSelected] = useState<TestItem | null>(null)
	const [openView, setOpenView] = useState(false)
	const [openReview, setOpenReview] = useState(false)
	// Datos base para rotular curso/sección y asignatura en el historial y en la vista
	const [courses, setCourses] = useState<any[]>([])
	const [sections, setSections] = useState<any[]>([])
	const [subjects, setSubjects] = useState<any[]>([])

	useEffect(() => {
		try {
			const raw = localStorage.getItem(TESTS_KEY)
			if (raw) setTests(JSON.parse(raw))
			setCourses(JSON.parse(localStorage.getItem('smart-student-courses') || '[]'))
			setSections(JSON.parse(localStorage.getItem('smart-student-sections') || '[]'))
			setSubjects(JSON.parse(localStorage.getItem('smart-student-subjects') || '[]'))
		} catch (e) {
			console.error("[Pruebas] Error cargando datos:", e)
		}
		const onStorage = (e: StorageEvent) => {
			if (!e.key) return
			if (e.key === TESTS_KEY) setTests(JSON.parse(e.newValue || '[]'))
			if (e.key === 'smart-student-courses') setCourses(JSON.parse(e.newValue || '[]'))
			if (e.key === 'smart-student-sections') setSections(JSON.parse(e.newValue || '[]'))
			if (e.key === 'smart-student-subjects') setSubjects(JSON.parse(e.newValue || '[]'))
		}
		window.addEventListener('storage', onStorage)
		return () => window.removeEventListener('storage', onStorage)
	}, [])

	const saveTests = (items: TestItem[]) => {
		setTests(items)
		localStorage.setItem(TESTS_KEY, JSON.stringify(items))
		window.dispatchEvent(
			new StorageEvent("storage", { key: TESTS_KEY, newValue: JSON.stringify(items) })
		)
	}

	// Generador local de preguntas basado en el tema y los contadores
	const generateQuestions = (topic: string, counts?: { tf: number; mc: number; ms: number; des?: number }): AnyQuestion[] => {
		const out: AnyQuestion[] = []
		if (!counts) return out

		const makeId = (p: string) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
		const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
		const cleanTopic = (topic || "Tema").trim()

		// Verdadero/Falso
		for (let i = 0; i < (counts.tf || 0); i++) {
			const positive = Math.random() > 0.5
			const text = positive
				? `${cap(cleanTopic)}: la afirmación ${i + 1} es correcta según lo visto en clase.`
				: `${cap(cleanTopic)}: la afirmación ${i + 1} es incorrecta de acuerdo al contenido.`
			out.push({ id: makeId("tf"), type: "tf", text, answer: positive, explanation: positive ? "Es consistente con la definición del tema." : "Contradice el concepto central del tema." })
		}

		// Alternativas (una correcta)
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

		// Selección múltiple (varias correctas)
		for (let i = 0; i < (counts.ms || 0); i++) {
			const stem = `Marque todas las opciones que corresponden a ${cleanTopic} (ítem ${i + 1}).`
			const base = [
				{ text: `Propiedad clave de ${cleanTopic}.`, correct: true },
				{ text: `Característica secundaria de ${cleanTopic}.`, correct: true },
				{ text: `Idea común pero no esencial de ${cleanTopic}.`, correct: false },
				{ text: `Concepto no relacionado con ${cleanTopic}.`, correct: false },
			]
			// Mezclar
			const shuffled = [...base].sort(() => Math.random() - 0.5)
			out.push({ id: makeId("ms"), type: "ms", text: stem, options: shuffled })
		}

		// Desarrollo
		for (let i = 0; i < (counts.des || 0); i++) {
			const prompt = `Desarrolle y justifique con sus palabras un análisis sobre ${cleanTopic} (ítem ${i + 1}).`
			const sampleAnswer = `Respuesta esperada: se espera que el estudiante explique los conceptos centrales de ${cleanTopic}, dé ejemplos y establezca conclusiones bien fundamentadas.`
			out.push({ id: makeId("des"), type: "des", prompt, sampleAnswer })
		}

		return out
	}

			const handleCreate = () => {
				const title = (newTitle.trim() || builder?.topic?.trim() || "Prueba")
			if (!title) return
		// Validar datos mínimos del constructor
		if (!builder?.courseId || !builder?.sectionId || !builder?.subjectId) {
			alert(translate('testsSelectAllBeforeCreate'))
			return
		}
		const now = Date.now()
		const questions = generateQuestions(builder?.topic || "", builder?.counts)
		// Resolver nombre de la asignatura para guardarlo junto con la prueba (fallback de visualización)
		const subjName = (() => {
			try {
				const list = subjects && Array.isArray(subjects) ? subjects : JSON.parse(localStorage.getItem('smart-student-subjects') || '[]')
				// 1) Buscar por ID exacto
				let found = list.find((x: any) => String(x?.id) === String(builder?.subjectId))
				if (found?.name) return found.name
				// 2) Algunas veces subjectId trae el nombre; buscar por nombre
				found = list.find((x: any) => String(x?.name) === String(builder?.subjectId))
				if (found?.name) return found.name
				// 3) Fallback: usar el valor que venga (subjectName o subjectId como nombre)
				return builder?.subjectName || (builder?.subjectId ? String(builder.subjectId) : '')
			} catch { return builder?.subjectName || (builder?.subjectId ? String(builder.subjectId) : '') }
		})()
		const item: TestItem = {
			id: `test_${now}`,
			title,
			description: "",
			createdAt: now,
			courseId: builder.courseId,
			sectionId: builder.sectionId,
			subjectId: builder.subjectId,
			subjectName: subjName,
			topic: builder.topic,
			counts: builder.counts,
			total: builder.total,
			questions,
		}
		const next = [item, ...tests]
		saveTests(next)
		setNewTitle("")
		setBuilder({})
	}

	const handleOpenView = (t: TestItem) => {
		setSelected(t)
		setOpenView(true)
	}

	const handleOpenReview = (t?: TestItem) => {
		if (t) setSelected(t)
		setOpenReview(true)
	}

	const handleEdit = (t: TestItem) => {
		const newTitle = prompt("Editar título de la prueba:", t.title) || t.title
		const newTopic = prompt("Editar tema:", t.topic || "") || t.topic
		const updated = tests.map((x) => (x.id === t.id ? { ...x, title: newTitle, topic: newTopic } : x))
		saveTests(updated)
	}

	const sorted = useMemo(() => {
		return [...tests].sort((a, b) => b.createdAt - a.createdAt)
	}, [tests])

		return (
		<div className="p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold flex items-center gap-2">
						<span className="inline-flex items-center justify-center rounded-md border border-fuchsia-200 bg-fuchsia-100 text-fuchsia-800 dark:border-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-200 p-1">
							<ClipboardCheck className="size-5" />
						</span>
						<span>{translate('testsPageTitle')}</span>
					</h1>
						<p className="text-sm text-muted-foreground">{translate('testsPageSub')}</p>
				</div>
			</div>

					<div className="space-y-4">
						<div className="border rounded-lg p-4">
							<div className="mb-3 text-sm font-medium">{translate('testsCreateTitle')}</div>
							<div className="mb-2 text-xs text-muted-foreground">{translate('testsCreateHint')}</div>
										<TestBuilder
											value={builder}
											onChange={setBuilder}
											onCreate={handleCreate}
										/>
						</div>
					</div>

					<div className="border rounded-lg">
								<div className="px-4 py-3">
									<div className="text-sm font-medium">{translate('testsHistoryTitle')}</div>
						</div>
				<div className="divide-y">
				{sorted.length === 0 ? (
						<div className="p-8 text-center text-muted-foreground">
								{translate('testsHistoryEmpty')}
					</div>
				) : (
						sorted.map((t) => (
							<div key={t.id} className="p-4 flex items-center justify-between gap-4">
								<div className="min-w-0">
									{/* Título */}
									<p className="font-medium truncate">{t.title}</p>
									{/* Fecha y hora */}
									<p className="text-xs text-muted-foreground">{`${translate('testsLabelDateTime')}: ${new Date(t.createdAt).toLocaleString()}`}</p>
									{/* Curso + Sección */}
									<p className="text-xs text-muted-foreground truncate">
										{(() => {
											const sec = sections.find((s:any) => String(s.id) === String(t.sectionId))
											const course = courses.find((c:any) => String(c.id) === String(t.courseId || sec?.courseId))
											const courseLabel = course?.name ? String(course.name) : ''
											const sectionLabel = sec?.name ? String(sec.name) : ''
											const label = [courseLabel, sectionLabel].filter(Boolean).join(' ')
											return label ? `${translate('testsLabelCourse')}: ${label}` : ''
										})()}
									</p>
									{/* Asignatura */}
									<p className="text-xs text-muted-foreground truncate">
										{(() => {
											const subj = subjects.find((s:any) => String(s.id) === String(t.subjectId)) || subjects.find((s:any) => String(s.name) === String(t.subjectId))
											const name = subj?.name || t.subjectName || (t.subjectId ? String(t.subjectId) : '')
											return name ? `${translate('testsLabelSubject')}: ${name}` : ''
										})()}
									</p>
									{/* Tema + Preguntas (resumen final) */}
									{t.counts && (
										<p className="text-xs text-muted-foreground truncate">
											{`${translate('testsLabelQuestions')}: ${translate('testsAbbrevTF')} ${t.counts.tf || 0}, ${translate('testsAbbrevMC')} ${t.counts.mc || 0}, ${translate('testsAbbrevMS')} ${t.counts.ms || 0}, ${translate('testsAbbrevDES')} ${t.counts.des || 0}`}
										</p>
									)}
								</div>
								<div className="flex items-center gap-2">
									<Button
										variant="outline"
										onClick={() => handleOpenView(t)}
										className="p-2 text-fuchsia-800 border-fuchsia-200 hover:bg-fuchsia-600 hover:text-white dark:border-fuchsia-800"
										aria-label={translate('testsBtnView')}
										title={translate('testsBtnView')}
									>
										<Eye className="size-4" />
									</Button>
									<Button
										variant="outline"
										onClick={() => handleOpenReview(t)}
										className="p-2 text-fuchsia-800 border-fuchsia-200 hover:bg-fuchsia-600 hover:text-white dark:border-fuchsia-800"
										aria-label={translate('testsReviewBtn')}
										title={translate('testsReviewBtn')}
									>
										<FileSearch className="size-4" />
									</Button>
									<Button
										variant="outline"
										onClick={() => handleEdit(t)}
										className="p-2 text-fuchsia-800 border-fuchsia-200 hover:bg-fuchsia-600 hover:text-white dark:border-fuchsia-800"
										aria-label={translate('testsBtnEdit')}
										title={translate('testsBtnEdit')}
									>
										<Pencil className="size-4" />
									</Button>
									<Button
										variant="outline"
										onClick={() => saveTests(tests.filter(x => x.id !== t.id))}
										className="p-2 text-fuchsia-800 border-fuchsia-200 hover:bg-fuchsia-600 hover:text-white dark:border-fuchsia-800"
										aria-label={translate('testsBtnDelete')}
										title={translate('testsBtnDelete')}
									>
										<Trash2 className="size-4" />
									</Button>
								</div>
							</div>
						))
					)}
				</div>
			</div>

			{/* Modales */}
			<TestViewDialog
				open={openView}
				onOpenChange={setOpenView}
				test={selected || undefined}
				onReview={() => handleOpenReview()}
			/>
			<TestReviewDialog
				open={openReview}
				onOpenChange={setOpenReview}
				test={selected || undefined}
			/>
		</div>
	)
}

