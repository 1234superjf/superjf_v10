"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { Plus, Eye, ClipboardCheck, FileSearch, Pencil, Trash2, CheckCircle, Lock } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { useAuth } from "@/contexts/auth-context"

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
	// Estado de generación (simulado mientras la IA prepara la prueba)
	status?: 'generating' | 'ready'
	progress?: number // 0-100
	// Propietario de la prueba (profesor que la creó)
	ownerId?: string
	ownerUsername?: string
}

// Clave base para historial de pruebas; se individualiza por usuario para aislar datos
const TESTS_BASE_KEY = "smart-student-tests"

function getTestsKey(user?: { username?: string | null } | null): string {
	const uname = user?.username ? String(user.username).trim().toLowerCase() : ''
	return uname ? `${TESTS_BASE_KEY}_${uname}` : TESTS_BASE_KEY
}

export default function PruebasPage() {
	const { translate, language } = useLanguage()
	const { user } = useAuth()
	const [tests, setTests] = useState<TestItem[]>([])
		const [newTitle, setNewTitle] = useState("")
		const [builder, setBuilder] = useState<any>({})
	const [selected, setSelected] = useState<TestItem | null>(null)
	const [openView, setOpenView] = useState(false)
	const [openReview, setOpenReview] = useState(false)
	const [openEdit, setOpenEdit] = useState(false)
	const [editDraft, setEditDraft] = useState<any>({})
	// Intervalo para progresos simulados
	const progressIntervalRef = useRef<number | null>(null)
	// Datos base para rotular curso/sección y asignatura en el historial y en la vista
	const [courses, setCourses] = useState<any[]>([])
	const [sections, setSections] = useState<any[]>([])
	const [subjects, setSubjects] = useState<any[]>([])

	useEffect(() => {
		// Cargar datasets base
		try {
			setCourses(JSON.parse(localStorage.getItem('smart-student-courses') || '[]'))
			setSections(JSON.parse(localStorage.getItem('smart-student-sections') || '[]'))
			setSubjects(JSON.parse(localStorage.getItem('smart-student-subjects') || '[]'))
		} catch (e) {
			console.error("[Pruebas] Error cargando datasets base:", e)
		}

		// Cargar historial específico del usuario (o global si no hay usuario)
		try {
			const key = getTestsKey(user)
			const raw = localStorage.getItem(key)
			if (raw) {
				setTests(JSON.parse(raw))
			} else {
				// Intentar migrar desde clave global solo los items que pertenezcan al usuario actual
				const globalRaw = localStorage.getItem(TESTS_BASE_KEY)
				if (globalRaw) {
					const globalItems: TestItem[] = JSON.parse(globalRaw)
					const mine = user ? globalItems.filter(t => (t.ownerId === user.id) || (t.ownerUsername === user.username)) : globalItems
					if (mine.length > 0) {
						localStorage.setItem(key, JSON.stringify(mine))
						setTests(mine)
					} else {
						setTests([])
					}
				} else {
					setTests([])
				}
			}
		} catch (e) {
			console.error("[Pruebas] Error cargando/migrando historial:", e)
		}

		// Listener de cambios en storage solo para la clave de este usuario
		const onStorage = (e: StorageEvent) => {
			if (!e.key) return
			const currentKey = getTestsKey(user)
			if (e.key === currentKey) setTests(JSON.parse(e.newValue || '[]'))
			if (e.key === 'smart-student-courses') setCourses(JSON.parse(e.newValue || '[]'))
			if (e.key === 'smart-student-sections') setSections(JSON.parse(e.newValue || '[]'))
			if (e.key === 'smart-student-subjects') setSubjects(JSON.parse(e.newValue || '[]'))
		}
		window.addEventListener('storage', onStorage)
		return () => window.removeEventListener('storage', onStorage)
	}, [user?.username])

	const saveTests = (items: TestItem[]) => {
	const key = getTestsKey(user)
	setTests(items)
	localStorage.setItem(key, JSON.stringify(items))
	window.dispatchEvent(new StorageEvent("storage", { key, newValue: JSON.stringify(items) }))
	}

	// Helper: actualiza progreso/estado de una prueba por id
	const patchTest = (id: string, patch: Partial<TestItem>) => {
		const key = getTestsKey(user)
		setTests(prev => {
			const updated: TestItem[] = prev.map(t => (t.id === id ? { ...t, ...patch } : t))
			localStorage.setItem(key, JSON.stringify(updated))
			window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(updated) }))
			return updated
		})
	}

	// Simular progreso de generación hasta 100% para pruebas con status 'generating'
	useEffect(() => {
		const hasGenerating = tests.some(t => t.status === 'generating')
		if (hasGenerating && !progressIntervalRef.current) {
			progressIntervalRef.current = window.setInterval(() => {
				setTests(prev => {
					let anyGenerating = false
					const updated: TestItem[] = prev.map((t): TestItem => {
						if (t.status === 'generating') {
							anyGenerating = true
							const inc = Math.floor(Math.random() * 8) + 3 // +3..+10
							const next = Math.min(100, (t.progress || 0) + inc)
							return { ...t, progress: next, status: (next >= 100 ? 'ready' : 'generating') as 'ready' | 'generating' }
						}
						return t
					})
					const key = getTestsKey(user)
					localStorage.setItem(key, JSON.stringify(updated))
					window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(updated) }))
					// Si ya no queda ninguna generando, paramos el intervalo
					if (!updated.some(x => x.status === 'generating') && progressIntervalRef.current) {
						window.clearInterval(progressIntervalRef.current)
						progressIntervalRef.current = null
					}
					return updated
				})
			}, 600) as unknown as number
		}
		if (!hasGenerating && progressIntervalRef.current) {
			window.clearInterval(progressIntervalRef.current)
			progressIntervalRef.current = null
		}
		return () => {
			if (progressIntervalRef.current) {
				window.clearInterval(progressIntervalRef.current)
				progressIntervalRef.current = null
			}
		}
	}, [tests])

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
				// Validar usuario actual: solo usuarios autenticados (profesor) pueden crear
				if (!user) {
					alert('Usuario no autenticado')
					return
				}
				const title = (newTitle.trim() || builder?.topic?.trim() || "Prueba")
			if (!title) return
		// Validar datos mínimos del constructor
		if (!builder?.courseId || !builder?.sectionId || !builder?.subjectId) {
			alert(translate('testsSelectAllBeforeCreate'))
			return
		}
		const now = Date.now()
		// Creamos inicialmente el registro en estado "generating"
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
			questions: [] as AnyQuestion[],
			status: 'generating',
		  progress: 0,
		  ownerId: user.id,
		  ownerUsername: user.username,
		}
		const next = [item, ...tests]
		saveTests(next)
		setNewTitle("")
		setBuilder({})

		// Lanzar generación con IA en segundo plano, reflejando progreso por fases
		// Conexión SSE para progreso en vivo desde servidor
		try {
			const id = item.id
			const countTF = Number(builder?.counts?.tf || 0)
			const countMC = Number(builder?.counts?.mc || 0)
			const countMS = Number(builder?.counts?.ms || 0)
			const questionCount = Math.max(1, countTF + countMC + countMS)
			const bookTitle = subjName || 'General'
			const topic = String(builder?.topic || title)
			const params = new URLSearchParams({
				topic,
				bookTitle,
				language: language === 'en' ? 'en' : 'es',
				questionCount: String(questionCount),
				timeLimit: '120',
			})
			const es = new EventSource(`/api/tests/generate/stream?${params.toString()}`)
			es.addEventListener('progress', (evt: MessageEvent) => {
				try {
					const data = JSON.parse(evt.data)
					const p = Math.min(100, Number(data?.percent ?? 0))
					patchTest(id, { progress: p })
				} catch {}
			})
			es.addEventListener('done', (evt: MessageEvent) => {
				try {
					const payload = JSON.parse(evt.data)
					const aiOut = payload?.data
					const mapped: AnyQuestion[] = (aiOut?.questions || []).map((q: any, idx: number) => {
						const makeId = (p: string) => `${p}_${now}_${idx}`
						if (q.type === 'TRUE_FALSE') return { id: makeId('tf'), type: 'tf', text: q.questionText || q.text || '', answer: !!q.correctAnswer }
						if (q.type === 'MULTIPLE_CHOICE') {
							const options: string[] = q.options || q.choices || []
							const correctIndex = typeof q.correctAnswerIndex === 'number' ? q.correctAnswerIndex : 0
							return { id: makeId('mc'), type: 'mc', text: q.questionText || q.text || '', options, correctIndex }
						}
						if (q.type === 'MULTIPLE_SELECTION') {
							const options: string[] = q.options || []
							const corrects: number[] = Array.isArray(q.correctAnswerIndices) ? q.correctAnswerIndices : []
							return { id: makeId('ms'), type: 'ms', text: q.questionText || q.text || '', options: options.map((t, i) => ({ text: String(t), correct: corrects.includes(i) })) }
						}
						return { id: makeId('des'), type: 'des', prompt: q.questionText || q.text || '' }
					})
					const desCount = Number(builder?.counts?.des || 0)
					if (desCount > 0) {
						const extra = generateQuestions(topic, { tf: 0, mc: 0, ms: 0, des: desCount })
						mapped.push(...extra)
					}
					patchTest(id, { questions: mapped, status: 'ready', progress: 100 })
				} finally {
					es.close()
				}
			})
			es.addEventListener('error', () => {
				// Fallback en caso de error del stream
				es.close()
				const fallback = generateQuestions(builder?.topic || '', builder?.counts)
				patchTest(id, { questions: fallback, status: 'ready', progress: 100 })
			})
		} catch (e) {
			console.error('[Pruebas] SSE error, usando generador local:', e)
			const fallback = generateQuestions(builder?.topic || '', builder?.counts)
			patchTest(item.id, { questions: fallback, status: 'ready', progress: 100 })
		}
	}

	const handleOpenView = (t: TestItem) => {
		setSelected(t)
		setOpenView(true)
	}

	const handleOpenReview = (t?: TestItem) => {
		if (t) setSelected(t)
		setOpenReview(true)
	}

	const getReviewKey = (id: string) => `smart-student-test-reviews_${id}`
	const hasAnyReview = (id: string) => {
		try { const raw = localStorage.getItem(getReviewKey(id)); const arr = raw ? JSON.parse(raw) : []; return Array.isArray(arr) && arr.length > 0 } catch { return false }
	}

	const handleEdit = (t: TestItem) => {
		// Si tiene revisiones, bloquear edición
		if (hasAnyReview(t.id)) {
			alert('No se puede editar: ya existe al menos una revisión de estudiante. La prueba debe permanecer igual para todos.')
			return
		}
		// Abrir modal de edición con TestBuilder en modo edit
		setSelected(t)
		setEditDraft({
			courseId: t.courseId,
			sectionId: t.sectionId,
			subjectId: t.subjectId || t.subjectName,
			topic: t.topic || '',
			counts: t.counts || { tf: 0, mc: 0, ms: 0, des: 0 },
			total: t.total || 0,
		})
		setOpenEdit(true)
	}

	const sorted = useMemo(() => {
		// Si no hay usuario, no mostrar nada
		if (!user) return [] as TestItem[]
		// Admin ve todas; profesores ven solo las suyas
		const source = user.role === 'admin' ? tests : tests.filter(t => (t.ownerId && t.ownerId === user.id) || (t.ownerUsername && t.ownerUsername === user.username))
		return [...source].sort((a, b) => b.createdAt - a.createdAt)
	}, [tests, user])

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
												{/* Indicador de progreso / listo */}
												{t.status === 'generating' ? (
													<div className="flex items-center gap-2 mr-1 min-w-[100px]" title={(() => {
														const p = Math.min(100, t.progress || 0)
														if (p < 25) return translate('testsProgressPhase1')
														if (p < 60) return translate('testsProgressPhase2')
														if (p < 85) return translate('testsProgressPhase3')
														return translate('testsProgressPhase4')
													})()}>
														<div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded" aria-label={`${Math.min(100, t.progress || 0)}%`}>
															<div className="h-2 bg-fuchsia-600 rounded" style={{ width: `${Math.min(100, t.progress || 0)}%` }} />
														</div>
														<span className="text-xs text-muted-foreground w-8 text-right">{Math.min(100, t.progress || 0)}%</span>
													</div>
												) : (
													<span className="inline-flex items-center text-green-600 dark:text-green-400 mr-1" title={translate('testsReady')} aria-label={translate('testsReady')}>
														<CheckCircle className="size-4" />
													</span>
												)}
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
																		{(() => {
																			const reviewed = hasAnyReview(t.id)
																			return (
																				<Button
										variant="outline"
																					onClick={() => handleEdit(t)}
																					disabled={reviewed}
																					className="p-2 text-fuchsia-800 border-fuchsia-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-fuchsia-600 hover:text-white dark:border-fuchsia-800"
																					aria-label={translate('testsBtnEdit')}
																					title={reviewed ? 'Bloqueado: existe historial de revisión' : translate('testsBtnEdit')}
																				>
																					{reviewed ? <Lock className="size-4" /> : <Pencil className="size-4" />}
																				</Button>
																			)
																		})()}
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

					{/* Modal simple de edición cuando no existen revisiones */}
					{openEdit && selected && (
						<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
							<div className="bg-background rounded-md shadow-lg w-full max-w-2xl p-4">
								<div className="flex items-center justify-between mb-2">
									<h2 className="text-lg font-semibold">Editar Prueba</h2>
									<button className="text-sm" onClick={() => setOpenEdit(false)}>✖</button>
								</div>
								<div className="mb-4 text-xs text-muted-foreground">Puede cambiar curso, sección, asignatura, tema y cantidades por tipo mientras no existan revisiones.</div>
								<TestBuilder value={editDraft} onChange={setEditDraft} mode="edit" />
								<div className="mt-4 flex justify-end gap-2">
									<Button variant="outline" onClick={() => setOpenEdit(false)}>Cancelar</Button>
									<Button onClick={() => {
										if (!editDraft?.sectionId || !editDraft?.subjectId) { alert('Seleccione curso/sección y asignatura'); return }
										// 1) Actualizar metadatos de la prueba y ponerla en estado de regeneración
										const resolveSubjectName = () => {
											try {
												const subjectsData = Array.isArray(subjects) && subjects.length ? subjects : JSON.parse(localStorage.getItem('smart-student-subjects') || '[]')
												const subj = subjectsData.find((s: any) => String(s.id) === String(editDraft.subjectId)) || subjectsData.find((s: any) => String(s.name) === String(editDraft.subjectId))
												return subj?.name || String(editDraft.subjectId)
											} catch { return String(editDraft.subjectId) }
										}
										const subjName = resolveSubjectName()
										const updated = tests.map((x): TestItem => x.id === selected.id ? {
											...x,
											courseId: editDraft.courseId,
											sectionId: editDraft.sectionId,
											subjectId: editDraft.subjectId,
											subjectName: subjName,
											topic: editDraft.topic,
											counts: editDraft.counts,
											total: editDraft.total,
											// Reiniciar documento
											questions: [] as AnyQuestion[],
											status: 'generating',
											progress: 0,
										} : x)
										saveTests(updated)
										setOpenEdit(false)

										// 2) Disparar regeneración por SSE igual que en creación
										try {
											const id = selected.id
											const countTF = Number(editDraft?.counts?.tf || 0)
											const countMC = Number(editDraft?.counts?.mc || 0)
											const countMS = Number(editDraft?.counts?.ms || 0)
											const desCount = Number(editDraft?.counts?.des || 0)
											const questionCount = Math.max(1, countTF + countMC + countMS)
											const bookTitle = subjName || 'General'
											const topic = String(editDraft?.topic || selected.title)
											const params = new URLSearchParams({
												topic,
												bookTitle,
												language: language === 'en' ? 'en' : 'es',
												questionCount: String(questionCount),
												timeLimit: '120',
											})
											const es = new EventSource(`/api/tests/generate/stream?${params.toString()}`)
											es.addEventListener('progress', (evt: MessageEvent) => {
												try {
													const data = JSON.parse(evt.data)
													const p = Math.min(100, Number(data?.percent ?? 0))
													patchTest(id, { progress: p })
												} catch {}
											})
											es.addEventListener('done', (evt: MessageEvent) => {
												try {
													const payload = JSON.parse(evt.data)
													const aiOut = payload?.data
													const now = Date.now()
													const mapped: AnyQuestion[] = (aiOut?.questions || []).map((q: any, idx: number) => {
														const makeId = (p: string) => `${p}_${now}_${idx}`
														if (q.type === 'TRUE_FALSE') return { id: makeId('tf'), type: 'tf', text: q.questionText || q.text || '', answer: !!q.correctAnswer }
														if (q.type === 'MULTIPLE_CHOICE') {
															const options: string[] = q.options || q.choices || []
															const correctIndex = typeof q.correctAnswerIndex === 'number' ? q.correctAnswerIndex : 0
															return { id: makeId('mc'), type: 'mc', text: q.questionText || q.text || '', options, correctIndex }
														}
														if (q.type === 'MULTIPLE_SELECTION') {
															const options: string[] = q.options || []
															const corrects: number[] = Array.isArray(q.correctAnswerIndices) ? q.correctAnswerIndices : []
															return { id: makeId('ms'), type: 'ms', text: q.questionText || q.text || '', options: options.map((t, i) => ({ text: String(t), correct: corrects.includes(i) })) }
														}
														return { id: makeId('des'), type: 'des', prompt: q.questionText || q.text || '' }
													})
													if (desCount > 0) {
														const extra = generateQuestions(topic, { tf: 0, mc: 0, ms: 0, des: desCount })
														mapped.push(...extra)
													}
													patchTest(id, { questions: mapped, status: 'ready', progress: 100 })
												} finally {
													es.close()
												}
											})
											es.addEventListener('error', () => {
												es.close()
												const fallback = generateQuestions(topic, editDraft?.counts)
												patchTest(id, { questions: fallback, status: 'ready', progress: 100 })
											})
										} catch (e) {
											console.error('[Pruebas] SSE error (edit), usando generador local:', e)
											const fallback = generateQuestions(editDraft?.topic || '', editDraft?.counts)
											patchTest(selected.id, { questions: fallback, status: 'ready', progress: 100 })
										}
									}}>Guardar</Button>
								</div>
							</div>
						</div>
					)}
		</div>
	)
}

