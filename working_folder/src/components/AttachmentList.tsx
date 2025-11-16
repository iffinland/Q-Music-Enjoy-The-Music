import React, { useState } from 'react';
import { FiX } from 'react-icons/fi';
import { DiscussionAttachment } from '../state/features/discussionsSlice';

interface AttachmentListProps {
  attachments: DiscussionAttachment[];
}

const AttachmentList: React.FC<AttachmentListProps> = ({ attachments }) => {
  if (!attachments || attachments.length === 0) return null;

  const [previewAttachment, setPreviewAttachment] = useState<DiscussionAttachment | null>(null);

  return (
    <>
      <div className="space-y-2 rounded-lg border border-slate-800/60 bg-slate-900/40 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Attached files</p>
        <ul className="space-y-2">
          {attachments.map((attachment) => {
            const isImage = attachment.mimeType.startsWith('image/');
            return (
              <li
                key={attachment.id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-slate-700/60 px-3 py-2"
              >
                {isImage ? (
                  <button
                    type="button"
                    onClick={() => setPreviewAttachment(attachment)}
                    className="group h-16 w-16 overflow-hidden rounded-md border border-slate-700/60"
                  >
                    <img
                      src={attachment.dataUrl}
                      alt={attachment.name}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  </button>
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-md border border-slate-700/60 text-slate-200 text-xs text-center px-2">
                    File
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-100">{attachment.name}</p>
                  <p className="text-xs text-slate-400">
                    {(attachment.size / 1024).toFixed(1)} KB — {attachment.mimeType}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      {previewAttachment && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/80 p-4">
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
    </>
  );
};

export default AttachmentList;
