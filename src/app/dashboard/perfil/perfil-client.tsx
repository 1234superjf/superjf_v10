"use client";

import { useLanguage } from '@/contexts/language-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserCircle, BarChart3, History as HistoryIcon, Download, Trash2, Edit3, Award, Percent, Newspaper, Network, FileQuestion } from 'lucide-react';
import type { UserProfile, SubjectProgress, EvaluationHistoryItem } from '@/lib/types';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';

// Mock Data - UserProfile remains mock for now
const userProfileData: UserProfile = {
  name: "Felipe",
  levelKey: "profileLevelValue",
  activeCoursesKey: "profileCourse8thGradeValue", 
  subjects: [
    { tag: "MAT", nameKey: "subjectMath", colorClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300" },
    { tag: "CIE", nameKey: "subjectScience", colorClass: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300" },
    { tag: "HIS", nameKey: "subjectHistory", colorClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300" }, 
    { tag: "LEN", nameKey: "subjectLanguage", colorClass: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300" }, 
  ],
  evaluationsCompleted: 0, // This will be updated by history length
};

// Template for learning stats structure with specific subject colors (now gradients)
const learningStatsTemplate: SubjectProgress[] = [
  { nameKey: "subjectMath", progress: 0, colorClass: "bg-gradient-to-r from-blue-300 via-blue-400 to-blue-600" },
  { nameKey: "subjectScience", progress: 0, colorClass: "bg-gradient-to-r from-green-300 via-green-400 to-green-600" },
  { nameKey: "subjectHistory", progress: 0, colorClass: "bg-gradient-to-r from-amber-300 via-amber-400 to-amber-600" }, 
  { nameKey: "subjectLanguage", progress: 0, colorClass: "bg-gradient-to-r from-red-300 via-red-400 to-red-600" },
];

// Template for profile stats cards
const profileStatsCardsTemplate = [
    { value: "0", labelKey: "statEvals", colorClass: "bg-gradient-to-r from-purple-500 to-purple-600", bgClass: "from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20", icon: Award }, 
    { value: "0%", labelKey: "statAvgScore", colorClass: "bg-gradient-to-r from-emerald-500 to-emerald-600", bgClass: "from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20", icon: Percent }, 
    { value: "0", labelKey: "statSummaries", colorClass: "bg-gradient-to-r from-blue-500 to-blue-600", bgClass: "from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20", icon: Newspaper },
    { value: "0", labelKey: "statMaps", colorClass: "bg-gradient-to-r from-amber-500 to-amber-600", bgClass: "from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20", icon: Network },
    { value: "0", labelKey: "statQuizzes", colorClass: "bg-gradient-to-r from-cyan-500 to-cyan-600", bgClass: "from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-800/20", icon: FileQuestion },
];

export default function PerfilClient() {
  const { translate, language } = useLanguage();
  const router = useRouter();
  const { toast } = useToast();
  const [evaluationHistory, setEvaluationHistory] = useState<EvaluationHistoryItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [mounted, setMounted] = useState(false);

  const [dynamicLearningStats, setDynamicLearningStats] = useState<SubjectProgress[]>(learningStatsTemplate);
  const [dynamicProfileCards, setDynamicProfileCards] = useState(profileStatsCardsTemplate);

  // Function to translate book titles based on current language
  const translateBookTitle = (bookTitle: string): string => {
    if (language === 'en') {
      // Map of Spanish book titles to English translations
      const bookTranslations: Record<string, string> = {
        'Ciencias Naturales': 'Natural Sciences',
        'Historia, Geografía y Ciencias Sociales': 'History, Geography and Social Sciences',
        'Lenguaje y Comunicación': 'Language and Communication',
        'Matemáticas': 'Mathematics',
        'Ciencias para la Ciudadanía': 'Science for Citizenship',
        'Biología': 'Biology',
        'Física': 'Physics',
        'Química': 'Chemistry',
        'Historia': 'History',
        'Inglés': 'English',
        'Educación Física': 'Physical Education',
        'Artes Visuales': 'Visual Arts',
        'Música': 'Music',
        'Tecnología': 'Technology',
        'Religión': 'Religion',
        'Orientación': 'Guidance'
      };

      // Try to find exact match first
      if (bookTranslations[bookTitle]) {
        return bookTranslations[bookTitle];
      }

      // For composite titles like "Ciencias Naturales 1ro Básico"
      for (const [spanish, english] of Object.entries(bookTranslations)) {
        if (bookTitle.includes(spanish)) {
          return bookTitle.replace(spanish, english);
        }
      }
    }
    
    return bookTitle; // Return original if no translation found or if in Spanish
  };

  // Ensure this only runs on client-side
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    try {
      const storedHistoryString = localStorage.getItem('evaluationHistory');
      if (storedHistoryString) {
        try {
          const storedHistory: EvaluationHistoryItem[] = JSON.parse(storedHistoryString);
          setEvaluationHistory(storedHistory);
        } catch (error) {
          console.error("Failed to parse evaluation history from localStorage:", error);
          setEvaluationHistory([]); 
        }
      }
       // Load counts for summaries, maps, and quizzes
      const summariesCount = localStorage.getItem('summariesCreatedCount') || '0';
      const mapsCount = localStorage.getItem('mapsCreatedCount') || '0';
      const quizzesCount = localStorage.getItem('quizzesCreatedCount') || '0';

      setDynamicProfileCards(prevCards => prevCards.map(card => {
          if (card.labelKey === "statSummaries") return { ...card, value: summariesCount };
          if (card.labelKey === "statMaps") return { ...card, value: mapsCount };
          if (card.labelKey === "statQuizzes") return { ...card, value: quizzesCount };
          return card;
      }));
    } catch (error) {
      console.error("Error accessing localStorage:", error);
    }

  }, [mounted]);

  useEffect(() => {
    if (!mounted || evaluationHistory.length === 0) return;
    
    const subjectMappings: Record<string, { es: string[], en: string[] }> = {
      subjectScience: {
        es: ["Ciencias", "Ciencias Naturales", "Biología", "Física", "Química", "Ciencias para la Ciudadanía"],
        en: ["Science", "Natural Sciences", "Biology", "Physics", "Chemistry", "Science for Citizenship"]
      },
      subjectHistory: {
        es: ["Historia", "Historia, Geografía y Ciencias Sociales", "Educación Ciudadana", "Filosofía"],
        en: ["History", "History, Geography and Social Sciences", "Civic Education", "Philosophy"]
      },
      subjectLanguage: {
        es: ["Lenguaje", "Lenguaje y Comunicación", "Lengua y Literatura"],
        en: ["Language", "Language and Communication", "Language and Literature"]
      },
      subjectMath: {
        es: ["Matemáticas"],
        en: ["Mathematics"]
      }
    };

    const newLearningStats = learningStatsTemplate.map(statTemplate => {
      const categoryKey = statTemplate.nameKey;
      let subjectEvaluations: EvaluationHistoryItem[] = [];

      if (subjectMappings[categoryKey]) {
        const currentLangSubjectNames = subjectMappings[categoryKey][language] || [];
        const otherLang = language === 'es' ? 'en' : 'es';
        const otherLangSubjectNames = subjectMappings[categoryKey][otherLang] || [];
        
        const titlesToMatch = [
          ...currentLangSubjectNames,
          ...otherLangSubjectNames
        ].map(title => title.toLowerCase());

        subjectEvaluations = evaluationHistory.filter(histItem => 
          titlesToMatch.includes(histItem.bookTitle.toLowerCase())
        );
      }
      
      let maxPercentage = 0;
      if (subjectEvaluations.length > 0) {
        subjectEvaluations.forEach(ev => {
          const percentage = ev.totalQuestions > 0 ? (ev.score / ev.totalQuestions) * 100 : 0;
          if (percentage > maxPercentage) {
            maxPercentage = percentage;
          }
        });
      }
      return {
        ...statTemplate, 
        progress: Math.round(maxPercentage),
      };
    });
    setDynamicLearningStats(newLearningStats);

    let totalScoreSum = 0;
    let totalPossibleScoreSum = 0;
    evaluationHistory.forEach(item => {
      totalScoreSum += item.score;
      totalPossibleScoreSum += item.totalQuestions;
    });
    const averageScorePercentage = totalPossibleScoreSum > 0 
      ? Math.round((totalScoreSum / totalPossibleScoreSum) * 100) 
      : 0;
    
    const newProfileCards = dynamicProfileCards.map(card => {
      if (card.labelKey === "statEvals") {
        return { ...card, value: evaluationHistory.length.toString() };
      }
      if (card.labelKey === "statAvgScore") {
        return { ...card, value: `${averageScorePercentage}%` };
      }
      return card; 
    });
    setDynamicProfileCards(newProfileCards);

  }, [evaluationHistory, language, translate, mounted]);

  const handleDeleteHistory = () => {
    if (!mounted) return;
    
    try {
      localStorage.removeItem('evaluationHistory');
      localStorage.removeItem('summariesCreatedCount'); 
      localStorage.removeItem('mapsCreatedCount'); 
      localStorage.removeItem('quizzesCreatedCount');
      setEvaluationHistory([]); 
      setCurrentPage(1);

      // Update profile cards immediately
      setDynamicProfileCards(prevCards => prevCards.map(card => {
          if (card.labelKey === "statEvals") return { ...card, value: "0" };
          if (card.labelKey === "statAvgScore") return { ...card, value: "0%" };
          if (card.labelKey === "statSummaries") return { ...card, value: "0" };
          if (card.labelKey === "statMaps") return { ...card, value: "0" };
          if (card.labelKey === "statQuizzes") return { ...card, value: "0" };
          return card;
      }));

      // Reset learning stats
      setDynamicLearningStats(learningStatsTemplate);

      toast({
        title: translate('historyDeletedTitle'),
        description: translate('historyDeletedDesc'),
        variant: "default"
      });
    } catch (error) {
      console.error("Error deleting history:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el historial",
        variant: "destructive"
      });
    }
  };

  const handleDownloadHistoryXlsx = async () => {
    if (!mounted) {
      toast({
        title: "Error",
        description: "La página aún se está cargando. Intenta de nuevo.",
        variant: "destructive"
      });
      return;
    }

    if (evaluationHistory.length === 0) {
        toast({
            title: translate('historyEmptyTitle'),
            description: translate('historyEmptyDesc'),
            variant: "default"
        });
        return;
    }

    try {
      // Dynamic import of XLSX to avoid SSR issues
      const XLSX = await import('xlsx');
      
      const headers = [
          translate('tableDate'),
          translate('tableCourse'),
          translate('tableBook'),
          translate('tableTopic'),
          translate('tableGrade') + " (%)",
          translate('tablePoints')
      ];

      const dataForSheet = evaluationHistory.map(item => {
          const gradePercentage = item.totalQuestions > 0 ? Math.round((item.score / item.totalQuestions) * 100) : 0;
          const points = `${item.score}/${item.totalQuestions}`;
          return [
              item.date,
              item.courseName,
              item.bookTitle,
              item.topic,
              gradePercentage, 
              points
          ];
      });

      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataForSheet]);
      
      const columnWidths = [
        {wch: 20}, // Date
        {wch: 20}, // Course
        {wch: 30}, // Book
        {wch: 30}, // Topic
        {wch: 10}, // Grade
        {wch: 10}  // Points
      ];
      ws['!cols'] = columnWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Historial Evaluaciones");

      XLSX.writeFile(wb, "historial_evaluaciones_smart_student.xlsx");
      
      toast({
        title: "Descarga exitosa",
        description: "El archivo Excel se ha descargado correctamente",
        variant: "default"
      });
    } catch (error) {
      console.error('Error downloading XLSX:', error);
      toast({
        title: "Error en descarga",
        description: "No se pudo descargar el archivo Excel. Intenta de nuevo.",
        variant: "destructive"
      });
    }
  };

  const handleRepasar = (item: EvaluationHistoryItem) => {
    router.push(`/dashboard/evaluacion?course=${encodeURIComponent(item.courseName)}&book=${encodeURIComponent(item.bookTitle)}&topic=${encodeURIComponent(item.topic)}`);
  };
  
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = evaluationHistory.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(evaluationHistory.length / itemsPerPage);

  // Don't render anything until client-side hydration is complete
  if (!mounted) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg mt-4"></div>
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg mt-4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-4 mb-2">
            <UserCircle className="w-8 h-8 text-primary" />
            <CardTitle className="text-2xl font-headline">{translate('profilePersonalTitle')}</CardTitle>
          </div>
          <CardDescription>{translate('profilePersonalSub')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <span className="font-semibold">{translate('profileName')}</span>
                <span className="ml-2">{userProfileData.name}</span>
              </div>
              <div>
                <span className="font-semibold">{translate('profileLevel')}</span>
                <span className="ml-2">{translate(userProfileData.levelKey)}</span>
              </div>
              <div>
                <span className="font-semibold">{translate('profileCourses')}</span>
                <span className="ml-2">{translate(userProfileData.activeCoursesKey)}</span>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <span className="font-semibold">{translate('profileSubjects')}</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {userProfileData.subjects.map((subject, index) => (
                    <span key={index} className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", subject.colorClass)}>
                      {subject.tag}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span className="font-semibold">{translate('profileEvalsCompleted')}</span>
                <span className="ml-2">{evaluationHistory.length}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="flex items-center gap-2">
              <Edit3 className="w-4 h-4" />
              {translate('profileChangePass')}
            </Button>
            <Button 
              variant="outline" 
              onClick={handleDownloadHistoryXlsx}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              {translate('profileDownloadHistory')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Profile Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {dynamicProfileCards.map((card, index) => (
          <Card key={index} className="relative overflow-hidden group hover:scale-105 hover:shadow-xl transition-all duration-300 cursor-pointer border-2 hover:border-primary/20">
            <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300", card.bgClass)}></div>
            <CardContent className="p-6 relative z-10 text-center">
              <div className="flex items-center justify-center gap-4 mb-3">
                <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", card.colorClass, "shadow-md group-hover:shadow-lg transition-shadow")}>
                  <card.icon className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-primary group-hover:text-primary/80 transition-colors">
                  {card.value}
                </div>
              </div>
              <div className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                {translate(card.labelKey)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Learning Progress */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-4 mb-2">
            <BarChart3 className="w-8 h-8 text-primary" />
            <CardTitle className="text-2xl font-headline">{translate('learningProgressTitle')}</CardTitle>
          </div>
          <CardDescription>{translate('learningProgressSub')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {dynamicLearningStats.map((stat, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{translate(stat.nameKey)}</span>
                  <span className="text-sm text-muted-foreground">{stat.progress}%</span>
                </div>
                <div className="relative">
                  <Progress value={stat.progress} className="h-3" />
                  <div 
                    className={cn("absolute top-0 left-0 h-3 rounded-full transition-all duration-500", stat.colorClass)}
                    style={{ width: `${stat.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Evaluation History */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-4 mb-2">
                <HistoryIcon className="w-8 h-8 text-primary" />
                <CardTitle className="text-2xl font-headline">{translate('evaluationHistoryTitle')}</CardTitle>
              </div>
              <CardDescription>{translate('evaluationHistorySub')}</CardDescription>
            </div>
            {evaluationHistory.length > 0 && (
              <Button 
                variant="destructive" 
                size="sm"
                onClick={handleDeleteHistory}
                className="flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {translate('historyDeleteButton')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {evaluationHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <HistoryIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>{translate('noEvaluationsYet')}</p>
              <p className="text-sm">{translate('noEvaluationsSubtext')}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{translate('tableDate')}</TableHead>
                      <TableHead>{translate('tableCourse')}</TableHead>
                      <TableHead>{translate('tableBook')}</TableHead>
                      <TableHead>{translate('tableTopic')}</TableHead>
                      <TableHead>{translate('tableGrade')}</TableHead>
                      <TableHead>{translate('tablePoints')}</TableHead>
                      <TableHead>{translate('tableActions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentItems.map((item) => {
                      const gradePercentage = item.totalQuestions > 0 ? Math.round((item.score / item.totalQuestions) * 100) : 0;
                      const gradeColorClass = gradePercentage >= 70 ? 'text-green-600 dark:text-green-400' : gradePercentage >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400';
                      
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.date}</TableCell>
                          <TableCell>{item.courseName}</TableCell>
                          <TableCell className="max-w-xs truncate" title={translateBookTitle(item.bookTitle)}>{translateBookTitle(item.bookTitle)}</TableCell>
                          <TableCell className="max-w-xs truncate" title={item.topic}>{item.topic}</TableCell>
                          <TableCell className={cn("font-semibold", gradeColorClass)}>{gradePercentage}%</TableCell>
                          <TableCell>{item.score}/{item.totalQuestions}</TableCell>
                          <TableCell>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleRepasar(item)}
                            >
                              {translate('reviewButton')}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    {translate('previousPage')}
                  </Button>
                  <span className="px-4 py-2 text-sm">
                    {translate('pageInfo', { current: currentPage, total: totalPages })}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    {translate('nextPage')}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
