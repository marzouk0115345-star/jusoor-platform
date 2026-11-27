import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, TASK_STATUS_LABELS_AR } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui/PageHeader';
import { StateBanner } from '../components/ui/StateBanner';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';

interface TaskListItem {
  id: number;
  studentUserId: number;
  studentName: string;
  categoryNameAr: string;
  fieldNameAr: string;
  title: string;
  description: string;
  requiredSkills: string;
  budget: string;
  expectedDuration: string;
  preferredMethod: string;
  deadline: string;
  status: string;
  offersCount: number;
}

export function TasksPage() {
  const { user, taxonomy, openAuthModal, locale } = useAuth();
  const isAr = locale === 'ar';
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fieldId, setFieldId] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [taskFieldId, setTaskFieldId] = useState('');
  const [requiredSkills, setRequiredSkills] = useState('');
  const [budget, setBudget] = useState('45');
  const [expectedDuration, setExpectedDuration] = useState('ساعتان');
  const [preferredMethod, setPreferredMethod] = useState('ONLINE');
  const [deadline, setDeadline] = useState('2026-12-10');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (fieldId) params.set('fieldId', fieldId);
      const res = await apiFetch<{ tasks: TaskListItem[] }>(
        `/api/tasks?${params.toString()}`
      );
      setTasks(res.tasks);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [q, statusFilter, fieldId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          categoryId: Number(
            categoryId || taxonomy?.taskCategories[0]?.id || 1
          ),
          fieldId: Number(taskFieldId || taxonomy?.fields[0]?.id || 1),
          requiredSkills,
          budget: Number(budget),
          expectedDuration,
          preferredMethod,
          deadline,
        }),
      });
      setShowCreate(false);
      setTitle('');
      setDescription('');
      setRequiredSkills('');
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر نشر المهمة');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        kicker={isAr ? 'مهام وإرشاد تطبيقي' : 'Learning Tasks Marketplace'}
        title={isAr ? 'سوق المهام التعليمية' : 'Educational Tasks Marketplace'}
        subtitle={
          isAr
            ? 'انشر ما تحتاج تعلّمه أو فهمه، وقارن عروض المعلّمين والمرشدين، واختر العرض الأنسب لك.'
            : 'Post what you need help learning, compare offers from verified teachers and mentors, and track delivery.'
        }
        actions={
          <button
            type="button"
            onClick={() => (user ? setShowCreate(true) : openAuthModal())}
            className="btn-jusoor-primary px-4 py-2.5 text-xs sm:text-sm inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <i className="bi bi-plus-lg" aria-hidden="true" />
            <span>{isAr ? 'نشر مهمة تعليمية جديدة' : 'Post New Task'}</span>
          </button>
        }
      />

      <div className="container-xxl px-3 px-sm-4 py-4 py-md-5 space-y-5">
        {/* Filters */}
        <div className="jusoor-card p-3 p-sm-4">
          <div className="row g-3">
            <div className="col-12 col-md-4">
              <div className="relative">
                <i
                  className="bi bi-search text-[#64748B] text-sm absolute start-3 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={isAr ? 'ابحث في المهام التعليمية...' : 'Search tasks...'}
                  aria-label={isAr ? 'ابحث في المهام' : 'Search tasks'}
                  className="jusoor-input w-full ps-9 pe-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="col-12 col-sm-6 col-md-4">
              <select
                value={fieldId}
                onChange={(e) => setFieldId(e.target.value)}
                aria-label={isAr ? 'تصفية حسب المجال' : 'Filter by field'}
                className="jusoor-select w-full px-3 py-2 text-sm"
              >
                <option value="">{isAr ? 'كل المجالات' : 'All Fields'}</option>
                {taxonomy?.fields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nameAr}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-sm-6 col-md-4">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label={isAr ? 'تصفية حسب الحالة' : 'Filter by status'}
                className="jusoor-select w-full px-3 py-2 text-sm"
              >
                <option value="">{isAr ? 'كل الحالات' : 'All Statuses'}</option>
                {Object.entries(TASK_STATUS_LABELS_AR).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Task List */}
        {loading ? (
          <LoadingSkeleton variant="list" count={4} />
        ) : tasks.length === 0 ? (
          <EmptyState
            icon="bi-briefcase"
            title={isAr ? 'لا توجد مهام مطابقة للبحث' : 'No matching tasks found'}
            description={
              isAr
                ? 'يمكنك نشر مهمة جديدة الآن ليستقبلها المعلّمون المختصون.'
                : 'You can post a new learning task now to receive proposals.'
            }
            action={
              (q || fieldId || statusFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setQ('');
                    setFieldId('');
                    setStatusFilter('');
                  }}
                  className="btn-jusoor-outline px-4 py-2 text-xs cursor-pointer"
                >
                  {isAr ? 'إعادة ضبط الفلاتر' : 'Reset Filters'}
                </button>
              )
            }
          />
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <Link
                key={task.id}
                to={`/tasks/${task.id}`}
                className="jusoor-card jusoor-card-interactive block p-4 p-sm-5"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="text-xs text-[#64748B] flex flex-wrap items-center gap-2">
                      <span>{task.categoryNameAr}</span>
                      <span aria-hidden="true">·</span>
                      <span>{task.fieldNameAr}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-bold text-[#0F766E]">
                        {TASK_STATUS_LABELS_AR[task.status] || task.status}
                      </span>
                    </div>
                    <h2 className="font-display text-base sm:text-lg font-bold text-[#102A43] m-0">
                      {task.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-[#64748B] line-clamp-2 m-0 leading-relaxed">
                      {task.description}
                    </p>
                    <div className="text-xs text-[#64748B] flex flex-wrap items-center gap-3 pt-1">
                      <span>
                        {isAr ? 'الطالب:' : 'Student:'} {task.studentName}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {isAr ? 'المدة:' : 'Duration:'} {task.expectedDuration}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num">
                        {isAr ? 'الموعد النهائي:' : 'Deadline:'} {task.deadline}
                      </span>
                    </div>
                  </div>

                  <div className="flex md:flex-col items-center md:items-end justify-between gap-2 shrink-0 md:text-end pt-3 md:pt-0 border-t md:border-t-0 border-[#EDF2F7]">
                    <div className="font-mono-num text-xl font-bold text-[#102A43]">
                      ${task.budget}
                    </div>
                    <div className="text-xs font-semibold text-[#247BA0] tabular-nums">
                      {task.offersCount} {isAr ? 'عروض مقدّمة' : 'offers'}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 bg-[#102A43]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-task-title"
        >
          <div className="jusoor-card w-full max-w-lg p-5 sm:p-6 my-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE5F0]">
              <h2
                id="create-task-title"
                className="font-display text-lg font-bold text-[#102A43] m-0"
              >
                نشر مهمة تعليمية جديدة
              </h2>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                aria-label="إغلاق"
                className="w-8 h-8 text-[#64748B] hover:bg-[#EEF4FA] rounded-lg inline-flex items-center justify-center cursor-pointer"
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>

            {error && (
              <StateBanner
                variant="error"
                message={error}
                onDismiss={() => setError(null)}
              />
            )}

            <form onSubmit={handleCreateTask} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                  عنوان المهمة التعليمية
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: أريد فهم قواعد البيانات وتطبيقها على مشروعي"
                  className="jusoor-input w-full px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                  اشرح المشكلة أو الهدف التعليمي بالتفصيل
                </label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="ما الذي تعرفه حالياً، وما العقبة التي تواجهك؟"
                  className="jusoor-textarea w-full px-3 py-2 text-sm"
                />
              </div>
              <div className="row g-2.5">
                <div className="col-12 col-sm-6">
                  <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                    تصنيف المهمة
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="jusoor-select w-full px-3 py-2 text-sm"
                  >
                    {taxonomy?.taskCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-sm-6">
                  <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                    المجال
                  </label>
                  <select
                    value={taskFieldId}
                    onChange={(e) => setTaskFieldId(e.target.value)}
                    className="jusoor-select w-full px-3 py-2 text-sm"
                  >
                    {taxonomy?.fields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="row g-2.5">
                <div className="col-6 col-sm-4">
                  <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                    الميزانية (USD)
                  </label>
                  <input
                    type="number"
                    required
                    min="5"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="jusoor-input w-full px-3 py-2 text-sm font-mono-num"
                  />
                </div>
                <div className="col-6 col-sm-4">
                  <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                    المدة المتوقعة
                  </label>
                  <input
                    type="text"
                    required
                    value={expectedDuration}
                    onChange={(e) => setExpectedDuration(e.target.value)}
                    className="jusoor-input w-full px-3 py-2 text-sm"
                  />
                </div>
                <div className="col-12 col-sm-4">
                  <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                    الموعد النهائي
                  </label>
                  <input
                    type="date"
                    required
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="jusoor-input w-full px-3 py-2 text-sm font-mono-num"
                  />
                </div>
              </div>
              <div className="row g-2.5">
                <div className="col-12 col-sm-6">
                  <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                    طريقة التدريس المفضلة
                  </label>
                  <select
                    value={preferredMethod}
                    onChange={(e) => setPreferredMethod(e.target.value)}
                    className="jusoor-select w-full px-3 py-2 text-sm"
                  >
                    <option value="ONLINE">عن بُعد (أونلاين)</option>
                    <option value="HYBRID">مدمج</option>
                    <option value="IN_PERSON">حضوري</option>
                  </select>
                </div>
                <div className="col-12 col-sm-6">
                  <label className="block text-xs font-semibold text-[#172B4D] mb-1">
                    المهارات المطلوبة
                  </label>
                  <input
                    type="text"
                    value={requiredSkills}
                    onChange={(e) => setRequiredSkills(e.target.value)}
                    placeholder="مثال: SQL, React"
                    className="jusoor-input w-full px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="btn-jusoor-primary w-full py-2.5 text-sm cursor-pointer"
              >
                {submitting ? 'جارٍ النشر...' : 'نشر المهمة التعليمية'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
