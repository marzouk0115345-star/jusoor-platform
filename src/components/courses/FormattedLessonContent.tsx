import React from 'react';

interface FormattedLessonContentProps {
  content: string;
}

function renderInlineBold(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-bold text-[#102A43]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

/**
 * Renders structured multi-line lesson content safely using React elements only
 * (supports ## headings, -/* bullet lists, blank-line paragraphs, and **bold** spans).
 */
export function FormattedLessonContent({ content }: FormattedLessonContentProps) {
  const lines = (content || '').replace(/\r\n/g, '\n').split('\n');
  const blocks: Array<
    | { type: 'heading'; text: string }
    | { type: 'list'; items: string[] }
    | { type: 'paragraph'; text: string }
  > = [];

  let paragraphBuf: string[] = [];
  let listBuf: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuf.length > 0) {
      blocks.push({ type: 'paragraph', text: paragraphBuf.join('\n') });
      paragraphBuf = [];
    }
  };

  const flushList = () => {
    if (listBuf.length > 0) {
      blocks.push({ type: 'list', items: listBuf });
      listBuf = [];
    }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    if (trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
      flushParagraph();
      flushList();
      blocks.push({
        type: 'heading',
        text: trimmed.replace(/^#{2,3}\s+/, ''),
      });
      continue;
    }

    if (
      trimmed.startsWith('- ') ||
      trimmed.startsWith('* ') ||
      trimmed.startsWith('• ')
    ) {
      flushParagraph();
      listBuf.push(trimmed.slice(2).trim());
      continue;
    }

    flushList();
    paragraphBuf.push(trimmed);
  }

  flushParagraph();
  flushList();

  if (blocks.length === 0) {
    return (
      <p className="text-sm text-[#64748B] leading-relaxed m-0">
        لا يوجد نص تفصيلي لهذا الدرس بعد.
      </p>
    );
  }

  return (
    <div className="space-y-3 text-sm text-[#172B4D] leading-relaxed">
      {blocks.map((block, idx) => {
        if (block.type === 'heading') {
          return (
            <h4
              key={idx}
              className="font-display text-base font-bold text-[#102A43] m-0 pt-1"
            >
              {renderInlineBold(block.text)}
            </h4>
          );
        }

        if (block.type === 'list') {
          return (
            <ul
              key={idx}
              className="m-0 ps-5 space-y-1.5 list-disc text-[#172B4D]"
            >
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx}>{renderInlineBold(item)}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={idx} className="m-0 whitespace-pre-line">
            {renderInlineBold(block.text)}
          </p>
        );
      })}
    </div>
  );
}
