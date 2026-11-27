import React, { useState } from 'react';
import {
  formatArabicLessonOrdinal,
  normalizeCourseLessonsOrder,
  reorderCourseLessons,
  type ProviderCourseLessonItem,
} from '../../lib/api';

interface CourseLessonsEditorProps {
  lessons: ProviderCourseLessonItem[];
  onChange: (nextLessons: ProviderCourseLessonItem[]) => void;
  lessonErrors?: Record<number, string>;
  sectionError?: string;
}

export function createEmptyCourseLesson(
  nextSortOrder = 1
): ProviderCourseLessonItem {
  return {
    moduleTitle: nextSortOrder === 1 ? 'الوحدة الأولى' : '',
    title: '',
    content: '',
    durationMinutes: 25,
    sortOrder: nextSortOrder,
    isFreePreview: nextSortOrder === 1,
  };
}

export function CourseLessonsEditor({
  lessons,
  onChange,
  lessonErrors = {},
  sectionError,
}: CourseLessonsEditorProps) {
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(
    null
  );

  const handleAddLesson = () => {
    setConfirmDeleteIndex(null);
    const next = normalizeCourseLessonsOrder([
      ...lessons,
      createEmptyCourseLesson(lessons.length + 1),
    ]);
    onChange(next);
  };

  const handleUpdateLesson = (
    idx: number,
    patch: Partial<ProviderCourseLessonItem>
  ) => {
    const next = lessons.map((lesson, i) =>
      i === idx ? { ...lesson, ...patch } : lesson
    );
    onChange(next);
  };

  const handleMove = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= lessons.length) return;
    setConfirmDeleteIndex(null);
    onChange(reorderCourseLessons(lessons, fromIdx, toIdx));
  };

  const handleDeleteLesson = (idx: number) => {
    setConfirmDeleteIndex(null);
    const remaining = lessons.filter((_, i) => i !== idx);
    onChange(normalizeCourseLessonsOrder(remaining));
  };

  const appendFormattingSnippet = (idx: number, snippet: string) => {
    const current = lessons[idx]?.content || '';
    const separator =
      current.trim().length === 0
        ? ''
        : current.endsWith('\n')
        ? ''
        : '\n';
    handleUpdateLesson(idx, { content: `${current}${separator}${snippet}` });
  };

  return (
    <div
      className="jusoor-subcard p-3.5 sm:p-4 space-y-3"
      data-testid="course-lessons-editor"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#DCE5F0]">
        <div>
          <h4 className="font-display text-sm font-bold text-[#102A43] m-0 flex items-center gap-2">
            <i className="bi bi-list-ol text-[#0F766E]" aria-hidden="true" />
            <span>محتوى الدورة والدروس ({lessons.length})</span>
          </h4>
          <p className="text-[11px] text-[#64748B] m-0 mt-0.5">
            أضف عدداً غير محدود من الدروس، وحدد عنوان ومحتوى كل درس، وأعد ترتيبها بسهولة.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAddLesson}
          data-testid="add-course-lesson-btn"
          className="btn-jusoor-primary px-3 py-1.5 text-xs inline-flex items-center gap-1.5 cursor-pointer"
        >
          <i className="bi bi-plus-circle" aria-hidden="true" />
          <span>إضافة درس جديد</span>
        </button>
      </div>

      {sectionError && (
        <div
          role="alert"
          className="px-3 py-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B] text-xs font-medium flex items-center gap-2"
        >
          <i className="bi bi-exclamation-triangle-fill shrink-0" aria-hidden="true" />
          <span>{sectionError}</span>
        </div>
      )}

      {lessons.length === 0 ? (
        <div className="bg-white border border-dashed border-[#CBD5E1] rounded-xl p-5 text-center space-y-2.5">
          <div className="text-sm font-bold text-[#102A43]">
            لم تُضف أي دروس بعد
          </div>
          <p className="text-xs text-[#64748B] m-0">
            يمكنك حفظ الدورة كمسودة الآن أو إضافة الدروس مباشرة قبل النشر.
          </p>
          <button
            type="button"
            onClick={handleAddLesson}
            className="btn-jusoor-outline px-4 py-1.5 text-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <i className="bi bi-plus-lg" aria-hidden="true" />
            <span>إضافة الدرس الأول</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {lessons.map((lesson, idx) => {
            const ordinalLabel = formatArabicLessonOrdinal(idx);
            const rowError = lessonErrors[idx];

            return (
              <div
                key={lesson.id ? `lesson-id-${lesson.id}` : `lesson-idx-${idx}`}
                data-testid={`course-lesson-card-${idx}`}
                className={`p-3.5 bg-white rounded-xl border space-y-3 transition-colors ${
                  rowError ? 'border-[#FCA5A5]' : 'border-[#DCE5F0]'
                }`}
              >
                {/* Lesson Header Bar: Arabic Ordinal + Reorder + Delete */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#F1F5F9]">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-md bg-[#E8F8F5] text-[#0F766E] text-xs font-bold">
                      {ordinalLabel}
                    </span>
                    <span className="text-xs font-semibold text-[#102A43] truncate max-w-[260px]">
                      {lesson.title.trim() || 'درس بدون عنوان'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMove(idx, idx - 1)}
                      aria-label={`تحريك ${ordinalLabel} للأعلى`}
                      title="تحريك للأعلى"
                      data-testid={`lesson-move-up-${idx}`}
                      className="w-7 h-7 rounded-lg border border-[#DCE5F0] bg-[#F8FBFF] text-[#102A43] hover:bg-[#EEF4FA] disabled:opacity-40 inline-flex items-center justify-center cursor-pointer text-xs"
                    >
                      <i className="bi bi-arrow-up" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === lessons.length - 1}
                      onClick={() => handleMove(idx, idx + 1)}
                      aria-label={`تحريك ${ordinalLabel} للأسفل`}
                      title="تحريك للأسفل"
                      data-testid={`lesson-move-down-${idx}`}
                      className="w-7 h-7 rounded-lg border border-[#DCE5F0] bg-[#F8FBFF] text-[#102A43] hover:bg-[#EEF4FA] disabled:opacity-40 inline-flex items-center justify-center cursor-pointer text-xs"
                    >
                      <i className="bi bi-arrow-down" aria-hidden="true" />
                    </button>

                    {confirmDeleteIndex === idx ? (
                      <div className="inline-flex items-center gap-1 bg-[#FEF2F2] border border-[#FECACA] px-2 py-1 rounded-lg">
                        <span className="text-[11px] font-semibold text-[#991B1B]">
                          حذف الدرس؟
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteLesson(idx)}
                          data-testid={`lesson-confirm-delete-${idx}`}
                          className="text-[11px] font-bold text-[#991B1B] underline cursor-pointer px-1"
                        >
                          تأكيد
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteIndex(null)}
                          className="text-[11px] font-semibold text-[#64748B] cursor-pointer px-1"
                        >
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteIndex(idx)}
                        data-testid={`lesson-delete-btn-${idx}`}
                        aria-label={`حذف ${ordinalLabel}`}
                        className="px-2.5 py-1 rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B] hover:bg-[#FEE2E2] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <i className="bi bi-trash" aria-hidden="true" />
                        <span>حذف</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Lesson Fields */}
                <div className="row g-2.5">
                  <div className="col-12 col-md-5">
                    <label className="block text-[11px] font-bold text-[#102A43] mb-1">
                      عنوان الدرس ({ordinalLabel}) *
                    </label>
                    <input
                      type="text"
                      value={lesson.title}
                      onChange={(e) =>
                        handleUpdateLesson(idx, { title: e.target.value })
                      }
                      placeholder={`مثال: مقدمة ${ordinalLabel} والمفاهيم الأساسية`}
                      data-testid={`lesson-title-input-${idx}`}
                      className="jusoor-input w-full px-3 py-1.5 text-xs sm:text-sm"
                    />
                  </div>

                  <div className="col-12 col-sm-7 col-md-4">
                    <label className="block text-[11px] font-bold text-[#102A43] mb-1">
                      الوحدة / المحور (اختياري)
                    </label>
                    <input
                      type="text"
                      value={lesson.moduleTitle || ''}
                      onChange={(e) =>
                        handleUpdateLesson(idx, { moduleTitle: e.target.value })
                      }
                      placeholder="مثال: الوحدة الأولى"
                      className="jusoor-input w-full px-3 py-1.5 text-xs sm:text-sm"
                    />
                  </div>

                  <div className="col-12 col-sm-5 col-md-3">
                    <label className="block text-[11px] font-bold text-[#102A43] mb-1">
                      المدة (دقيقة)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={600}
                      value={lesson.durationMinutes}
                      onChange={(e) =>
                        handleUpdateLesson(idx, {
                          durationMinutes: Number(e.target.value) || 20,
                        })
                      }
                      className="jusoor-input w-full px-3 py-1.5 text-xs sm:text-sm font-mono-num"
                    />
                  </div>

                  <div className="col-12 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-[11px] font-bold text-[#102A43]">
                        محتوى الدرس والشرح *
                      </label>
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            appendFormattingSnippet(idx, '## عنوان المحور')
                          }
                          className="px-2 py-0.5 rounded border border-[#DCE5F0] bg-[#F8FBFF] hover:bg-[#EEF4FA] text-[10px] font-semibold text-[#102A43] cursor-pointer"
                        >
                          + عنوان فرعي
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            appendFormattingSnippet(idx, '- نقطة تعليمية مهمة')
                          }
                          className="px-2 py-0.5 rounded border border-[#DCE5F0] bg-[#F8FBFF] hover:bg-[#EEF4FA] text-[10px] font-semibold text-[#102A43] cursor-pointer"
                        >
                          + نقطة قائمة
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            appendFormattingSnippet(idx, '**مصطلح مهم**')
                          }
                          className="px-2 py-0.5 rounded border border-[#DCE5F0] bg-[#F8FBFF] hover:bg-[#EEF4FA] text-[10px] font-semibold text-[#102A43] cursor-pointer"
                        >
                          + نص عريض
                        </button>
                      </div>
                    </div>

                    <textarea
                      rows={3}
                      value={lesson.content}
                      onChange={(e) =>
                        handleUpdateLesson(idx, { content: e.target.value })
                      }
                      data-testid={`lesson-content-input-${idx}`}
                      placeholder="اكتب شرح الدرس، النقاط الرئيسية، والتمارين العملية... (يدعم السطور المتعددة و ## العناوين و - القوائم)"
                      className="jusoor-textarea w-full px-3 py-2 text-xs sm:text-sm leading-relaxed"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-[#172B4D] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lesson.isFreePreview}
                      onChange={(e) =>
                        handleUpdateLesson(idx, {
                          isFreePreview: e.target.checked,
                        })
                      }
                    />
                    <span>إتاحة الدرس كمعاينة مجانية للزوار قبل التسجيل</span>
                  </label>

                  {rowError && (
                    <span className="text-[11px] font-semibold text-[#991B1B]">
                      {rowError}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {lessons.length > 0 && (
        <div className="pt-1 flex justify-end">
          <button
            type="button"
            onClick={handleAddLesson}
            className="btn-jusoor-outline px-3 py-1.5 text-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <i className="bi bi-plus-lg" aria-hidden="true" />
            <span>إضافة درس جديد ({formatArabicLessonOrdinal(lessons.length)})</span>
          </button>
        </div>
      )}
    </div>
  );
}
