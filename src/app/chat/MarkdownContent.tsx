"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  content: string;
}

export const MarkdownContent: React.FC<MarkdownContentProps> = ({ content }) => {
  return (
    <div className="prose prose-invert max-w-none text-slate-200 text-sm leading-relaxed space-y-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ ...props }) => (
            <h1 className="text-lg font-bold text-white mt-4 mb-2 pb-1 border-b border-slate-800" {...props} />
          ),
          h2: ({ ...props }) => (
            <h2 className="text-base font-semibold text-white mt-4 mb-2 flex items-center gap-1.5" {...props} />
          ),
          h3: ({ ...props }) => (
            <h3 className="text-sm font-semibold text-emerald-400 mt-3.5 mb-1.5 flex items-center gap-1.5" {...props} />
          ),
          h4: ({ ...props }) => (
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mt-3 mb-1" {...props} />
          ),
          p: ({ ...props }) => (
            <p className="text-sm text-slate-300 leading-relaxed mb-2.5 last:mb-0" {...props} />
          ),
          ul: ({ ...props }) => (
            <ul className="list-disc pl-5 my-2 space-y-1 text-sm text-slate-300" {...props} />
          ),
          ol: ({ ...props }) => (
            <ol className="list-decimal pl-5 my-2 space-y-1.5 text-sm text-slate-300" {...props} />
          ),
          li: ({ ...props }) => (
            <li className="leading-relaxed" {...props} />
          ),
          strong: ({ ...props }) => (
            <strong className="font-semibold text-slate-100" {...props} />
          ),
          em: ({ ...props }) => (
            <em className="italic text-slate-300" {...props} />
          ),
          hr: () => (
            <hr className="my-3 border-t border-slate-800" />
          ),
          blockquote: ({ ...props }) => (
            <blockquote
              className="border-l-2 border-amber-500/80 bg-amber-950/20 rounded-r-lg px-3.5 py-2 my-2.5 text-xs sm:text-sm text-amber-200/90 leading-relaxed"
              {...props}
            />
          ),
          table: ({ ...props }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-left border-collapse text-xs" {...props} />
            </div>
          ),
          thead: ({ ...props }) => (
            <thead className="bg-slate-800/80 text-slate-200 font-semibold" {...props} />
          ),
          tbody: ({ ...props }) => (
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/40 text-slate-300" {...props} />
          ),
          tr: ({ ...props }) => (
            <tr className="hover:bg-slate-800/30 transition-colors" {...props} />
          ),
          th: ({ ...props }) => (
            <th className="px-3 py-2 text-xs font-semibold text-slate-200 border-b border-slate-700" {...props} />
          ),
          td: ({ ...props }) => (
            <td className="px-3 py-2 text-xs text-slate-300" {...props} />
          ),
          a: ({ ...props }) => (
            <a
              className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors font-medium"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 font-mono text-[12px] border border-slate-700/50"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <div className="my-3 rounded-xl border border-slate-800 bg-slate-950/90 p-3 overflow-x-auto text-xs font-mono text-slate-200">
                <code className={className} {...props}>
                  {children}
                </code>
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
