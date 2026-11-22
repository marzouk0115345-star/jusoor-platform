import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, X, Briefcase } from 'lucide-react';
import { apiFetch, TASK_STATUS_LABELS_AR } from '../lib/api';
import { useAuth } from '../context/AuthContext';

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
  const { user, taxonomy, openAuthModal } = useAuth();
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900">
            سوق المهام التعليمية
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            انشر ما تحتاج تعلّمه أو فهمه، وقارن عروض المعلّمين والمرشدين، واختر العرض الأنسب لك.
          </p>
        </div>

        <button
          type="button"
          onClick={() => (user ? setShowCreate(true) : openAuthModal())}
          className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap cursor-pointer self-start"
        >
          <Plus className="w-4 h-4" />
          <span>نشر مهمة تعليمية جديدة</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث في المهام التعليمية..."
            aria-label="ابحث في المهام"
            className="w-full pr-9 pl-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700"
          />
        </div>
        <select
          value={fieldId}
          onChange={(e) => setFieldId(e.target.value)}
          aria-label="تصفية حسب المجال"
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
        >
          <option value="">كل المجالات</option>
          {taxonomy?.fields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nameAr}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="تصفية حسب الحالة"
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
        >
          <option value="">كل الحالات</option>
          {Object.entries(TASK_STATUS_LABELS_AR).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-36 bg-white border border-slate-200 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-2">
          <Briefcase className="w-8 h-8 text-slate-400 mx-auto" />
          <div className="font-semibold text-slate-900">
            لا توجد مهام مطابقة للبحث
          </div>
          <p className="text-xs text-slate-500">
            يمكنك نشر مهمة جديدة الآن ليستقبلها المعلّمون المختصون.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <Link
              key={task.id}
              to={`/tasks/${task.id}`}
              className="block bg-white border border-slate-200 hover:border-teal-600 rounded-xl p-5 sm:p-6 transition-colors"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                    <span>{task.categoryNameAr}</span>
                    <span aria-hidden="true">·</span>
                    <span>{task.fieldNameAr}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-teal-800">
                      {TASK_STATUS_LABELS_AR[task.status] || task.status}
                    </span>
                  </div>
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    {task.title}
                  </h2>
                  <p className="text-sm text-slate-600 line-clamp-2">
                    {task.description}
                  </p>
                  <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3 pt-1">
                    <span>الطالب: {task.studentName}</span>
                    <span aria-hidden="true">·</span>
                    <span>المدة: {task.expectedDuration}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num">
                      الموعد النهائي: {task.deadline}
                    </span>
                  </div>
                </div>

                <div className="flex md:flex-col items-center md:items-end justify-between gap-2 shrink-0 md:text-left">
                  <div className="font-mono-num text-xl font-bold text-slate-900">
                    ${task.budget}
                  </div>
                  <div className="text-xs font-semibold text-teal-700 tabular-nums">
                    {task.offersCount} عروض مقدّمة
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Task Modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-task-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2
                id="create-task-title"
                className="font-display text-lg font-bold text-slate-900"
              >
                نشر مهمة تعليمية جديدة
              </h2>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                aria-label="إغلاق"
                className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateTask} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  عنوان المهمة التعليمية
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: أريد فهم قواعد البيانات وتطبيقها على مشروعي"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  اشرح المشكلة أو الهدف التعليمي بالتفصيل
                </label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="ما الذي تعرفه حالياً، وما العقبة التي تواجهك؟"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    تصنيف المهمة
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {taxonomy?.taskCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    المجال
                  </label>
                  <select
                    value={taskFieldId}
                    onChange={(e) => setTaskFieldId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {taxonomy?.fields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    الميزانية (USD)
                  </label>
                  <input
                    type="number"
                    required
                    min="5"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    المدة المتوقعة
                  </label>
                  <input
                    type="text"
                    required
                    value={expectedDuration}
                    onChange={(e) => setExpectedDuration(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    الموعد النهائي
                  </label>
                  <input
                    type="date"
                    required
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    طريقة التدريس المفضلة
                  </label>
                  <select
                    value={preferredMethod}
                    onChange={(e) => setPreferredMethod(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="ONLINE">عن بُعد (أونلاين)</option>
                    <option value="HYBRID">مدمج</option>
                    <option value="IN_PERSON">حضوري</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    المهارات المطلوبة
                  </label>
                  <input
                    type="text"
                    value={requiredSkills}
                    onChange={(e) => setRequiredSkills(e.target.value)}
                    placeholder="مثال: SQL, React"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-lg cursor-pointer disabled:opacity-60"
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
