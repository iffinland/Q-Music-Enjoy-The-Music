import React, { useMemo, useRef, useState } from 'react';
import { FiBold, FiItalic, FiUnderline, FiPaperclip, FiSmile, FiX } from 'react-icons/fi';
import { RxStrikethrough } from 'react-icons/rx';
import { toast } from 'react-hot-toast';
import { DiscussionAttachment } from '../state/features/discussionsSlice';

const MAX_TOTAL_ATTACHMENTS = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const EMOJIS = ['😀', '😂', '😍', '🤔', '😎', '👍', '🎵', '🔥', '🙏', '🚀'];
const TEXT_COLORS = [
  { label: 'Sky', value: '#38bdf8' },
  { label: 'Emerald', value: '#34d399' },
  { label: 'Amber', value: '#facc15' },
  { label: 'Rose', value: '#f472b6' },
  { label: 'Red', value: '#f87171' },
  { label: 'Violet', value: '#a78bfa' },
];
const HIGHLIGHT_COLORS = [
  { label: 'Soft Yellow', value: '#fef9c3' },
  { label: 'Mint', value: '#d1fae5' },
  { label: 'Sky', value: '#e0f2fe' },
  { label: 'Lavender', value: '#ede9fe' },
  { label: 'Peach', value: '#ffedd5' },
  { label: 'Slate', value: '#cbd5f5' },
];

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });

const toAttachment = async (file: File): Promise<DiscussionAttachment> => ({
  id: generateId(),
  name: file.name,
  mimeType: file.type || 'application/octet-stream',
  size: file.size,
  dataUrl: await readFileAsDataUrl(file),
});

interface RichTextInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minRows?: number;
  disabled?: boolean;
  attachments: DiscussionAttachment[];
  onAttachmentsChange: (attachments: DiscussionAttachment[]) => void;
}

const RichTextInput: React.FC<RichTextInputProps> = ({
  id,
  value,
  onChange,
  placeholder,
  minRows = 4,
  disabled = false,
  attachments,
  onAttachmentsChange,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<DiscussionAttachment | null>(null);
  const [isTextColorOpen, setIsTextColorOpen] = useState(false);
  const [isHighlightOpen, setIsHighlightOpen] = useState(false);

  const formattedAttachmentLimitText = useMemo(() => `${attachments.length}/${MAX_TOTAL_ATTACHMENTS} attachments`, [attachments.length]);

  const wrapSelection = (prefix: string, suffix: string, fallback: string) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart ?? value.length;
    const end = textarea.selectionEnd ?? value.length;
    const current = value;
    const selection = current.slice(start, end) || fallback;
    const nextValue = `${current.slice(0, start)}${prefix}${selection}${suffix}${current.slice(end)}`;
    onChange(nextValue);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursorStart = start + prefix.length;
      const cursorEnd = cursorStart + selection.length;
      textarea.setSelectionRange(cursorStart, cursorEnd);
    });
  };

  const applyTextColor = (color: string) => {
    wrapSelection(`[color=${color}]`, '[/color]', 'colored text');
  };

  const applyHighlight = (color: string) => {
    wrapSelection(`[bg=${color}]`, '[/bg]', 'highlighted text');
  };

  const handleEmojiSelect = (emoji: string) => {
    onChange(`${value}${emoji}`);
    setIsEmojiOpen(false);
    textareaRef.current?.focus();
  };

  const handleAttachmentsSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    const totalPossible = attachments.length + files.length;
    if (totalPossible > MAX_TOTAL_ATTACHMENTS) {
      toast.error(`Limit ${MAX_TOTAL_ATTACHMENTS} files. Remove a file before adding new ones.`);
      event.target.value = '';
      return;
    }

    try {
      const processed: DiscussionAttachment[] = [];
      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`"${file.name}" is larger than ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
          continue;
        }
        if (!file.type.startsWith('image/')) {
          toast.error(`"${file.name}" is not an image. Only image attachments are allowed.`);
          continue;
        }
        processed.push(await toAttachment(file));
      }
      if (processed.length > 0) {
        onAttachmentsChange([...attachments, ...processed]);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to attach file.');
    } finally {
      event.target.value = '';
    }
  };

  const removeAttachment = (idToRemove: string) => {
    onAttachmentsChange(attachments.filter((attachment) => attachment.id !== idToRemove));
  };

  const formattingButtons = [
    { label: 'Bold', icon: <FiBold />, action: () => wrapSelection('**', '**', 'bold text') },
    { label: 'Italic', icon: <FiItalic />, action: () => wrapSelection('_', '_', 'italic text') },
    { label: 'Underline', icon: <FiUnderline />, action: () => wrapSelection('__', '__', 'underlined text') },
    { label: 'Strikethrough', icon: <RxStrikethrough />, action: () => wrapSelection('~~', '~~', 'strikethrough') },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {formattingButtons.map((button) => (
          <button
            key={button.label}
            type="button"
            disabled={disabled}
            onClick={button.action}
            className="flex items-center gap-1 rounded-md border border-slate-700/60 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:bg-slate-900/60 disabled:opacity-60"
          >
            {button.icon}
            {button.label}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 rounded-md border border-slate-700/60 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:bg-slate-900/60 disabled:opacity-60"
        >
          <FiPaperclip />
          Attach
        </button>
        <div className="relative">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setIsTextColorOpen((prev) => !prev);
              setIsHighlightOpen(false);
            }}
            className="flex items-center gap-1 rounded-md border border-slate-700/60 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:bg-slate-900/60 disabled:opacity-60"
          >
            Text Color
          </button>
          {isTextColorOpen && (
            <div className="absolute z-20 mt-2 w-44 rounded-lg border border-slate-700/60 bg-slate-900/90 p-2 shadow-lg">
              <p className="mb-2 text-[10px] uppercase tracking-wide text-slate-400">Choose color</p>
              <div className="grid grid-cols-2 gap-2">
                {TEXT_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => {
                      applyTextColor(color.value);
                      setIsTextColorOpen(false);
                    }}
                    className="flex items-center gap-2 rounded-md border border-slate-700/50 px-2 py-1 text-xs text-slate-100 hover:bg-slate-800/70"
                  >
                    <span
                      className="h-3 w-3 rounded-full border border-white/30"
                      style={{ backgroundColor: color.value }}
                    />
                    {color.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setIsHighlightOpen((prev) => !prev);
              setIsTextColorOpen(false);
            }}
            className="flex items-center gap-1 rounded-md border border-slate-700/60 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:bg-slate-900/60 disabled:opacity-60"
          >
            Highlight
          </button>
          {isHighlightOpen && (
            <div className="absolute z-20 mt-2 w-44 rounded-lg border border-slate-700/60 bg-slate-900/90 p-2 shadow-lg">
              <p className="mb-2 text-[10px] uppercase tracking-wide text-slate-400">Choose background</p>
              <div className="grid grid-cols-2 gap-2">
                {HIGHLIGHT_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => {
                      applyHighlight(color.value);
                      setIsHighlightOpen(false);
                    }}
                    className="flex items-center gap-2 rounded-md border border-slate-700/50 px-2 py-1 text-xs text-slate-100 hover:bg-slate-800/70"
                  >
                    <span
                      className="h-3 w-3 rounded border border-slate-600/70"
                      style={{ backgroundColor: color.value }}
                    />
                    {color.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsEmojiOpen((prev) => !prev)}
            className="flex items-center gap-1 rounded-md border border-slate-700/60 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:bg-slate-900/60 disabled:opacity-60"
          >
            <FiSmile />
            Emoji
          </button>
          {isEmojiOpen && (
            <div className="absolute z-20 mt-2 w-48 rounded-lg border border-slate-700/60 bg-slate-900/90 p-2 shadow-lg">
              <div className="grid grid-cols-5 gap-2">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="text-lg hover:scale-110"
                    onClick={() => handleEmojiSelect(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleAttachmentsSelected}
        />
      </div>
      <textarea
        id={id}
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        rows={minRows}
        placeholder={placeholder}
        className="w-full rounded-lg border border-sky-800/70 bg-slate-900/70 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none disabled:opacity-50"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span>{value.trim().length} characters</span>
        <span className="flex items-center gap-2">
          <span>{formattedAttachmentLimitText}</span>
          <span className="text-[10px] uppercase tracking-wide text-slate-500">Only images allowed</span>
        </span>
      </div>
      {attachments.length > 0 && (
        <div className="space-y-2 rounded-lg border border-slate-700/60 bg-slate-900/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Attachments</p>
          <ul className="space-y-2 text-sm text-slate-100">
            {attachments.map((attachment) => {
              const isImage = attachment.mimeType.startsWith('image/');
              return (
                <li
                  key={attachment.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-700/60 px-3 py-2"
                >
                  <div>
                    <p className="font-semibold">{attachment.name}</p>
                    <p className="text-xs text-slate-400">
                      {(attachment.size / 1024).toFixed(1)} KB — {attachment.mimeType}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {isImage && (
                      <button
                        type="button"
                        onClick={() => setPreviewAttachment(attachment)}
                        className="rounded-md border border-slate-700/60 px-3 py-1 text-slate-200 hover:bg-slate-800/80"
                      >
                        Preview
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAttachment(attachment.id)}
                      className="rounded-md border border-slate-700/60 px-3 py-1 text-red-200 hover:bg-red-900/30"
                      disabled={disabled}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {previewAttachment && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/80 p-4">
          <div className="relative max-h-[90vh] max-w-[90vw] rounded-xl bg-slate-950/90 p-4">
            <button
              type="button"
              className="absolute right-4 top-4 rounded-full border border-slate-700/60 bg-slate-900/60 p-2 text-slate-100 hover:bg-slate-800/80"
              onClick={() => setPreviewAttachment(null)}
            >
              <FiX />
            </button>
            <img
              src={previewAttachment.dataUrl}
              alt={previewAttachment.name}
              className="max-h-[80vh] max-w-[80vw] rounded-lg object-contain"
            />
            <p className="mt-2 text-center text-sm text-slate-200">{previewAttachment.name}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RichTextInput;
