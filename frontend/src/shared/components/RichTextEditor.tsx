import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Code2,
  Link as LinkIcon,
  ImageIcon,
} from 'lucide-react'
import { useRef, useCallback } from 'react'

interface Props {
  value: string
  onChange: (html: string) => void
  onImageUpload?: (file: File) => Promise<string>
  placeholder?: string
  readOnly?: boolean
}

/**
 * Convert plain text (no HTML tags) to simple HTML paragraphs
 * for backward compatibility with old articles.
 */
function ensureHtml(content: string): string {
  if (!content) return ''
  // If content already contains HTML tags, use as-is
  if (/<[a-z][\s\S]*>/i.test(content)) return content
  // Plain text → wrap each line in <p>
  return content
    .split('\n')
    .map((line) => `<p>${line || '<br>'}</p>`)
    .join('')
}

function ToolbarButton({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean
  onClick: () => void
  children: React.ReactNode
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-accent-purple/30 text-white'
          : 'text-gray-400 hover:text-white hover:bg-dark-600/50'
      }`}
    >
      {children}
    </button>
  )
}

export function RichTextEditor({
  value,
  onChange,
  onImageUpload,
  placeholder = 'Начните писать...',
  readOnly = false,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Image.configure({
        HTMLAttributes: { class: 'rounded-lg max-w-full' },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-accent-purple underline' },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: ensureHtml(value),
    editable: !readOnly,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML())
    },
  })

  const handleImageUpload = useCallback(async () => {
    if (!onImageUpload || !fileInputRef.current) return
    fileInputRef.current.click()
  }, [onImageUpload])

  const onFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !onImageUpload || !editor) return
      try {
        const url = await onImageUpload(file)
        editor.chain().focus().setImage({ src: url }).run()
      } catch {
        // error handled by caller
      }
      // Reset input so the same file can be selected again
      e.target.value = ''
    },
    [editor, onImageUpload],
  )

  const setLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes('link').href || ''
    const url = window.prompt('URL ссылки:', prev)
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }
  }, [editor])

  if (!editor) return null

  return (
    <div className="border border-dark-600/50 rounded-xl overflow-hidden bg-dark-700/50">
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-dark-600/50 bg-dark-800/30 flex-wrap">
          <ToolbarButton
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Жирный"
          >
            <Bold className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Курсив"
          >
            <Italic className="w-4 h-4" />
          </ToolbarButton>
          <div className="w-px h-5 bg-dark-600/50 mx-1" />
          <ToolbarButton
            active={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            title="Заголовок 2"
          >
            <Heading2 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('heading', { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            title="Заголовок 3"
          >
            <Heading3 className="w-4 h-4" />
          </ToolbarButton>
          <div className="w-px h-5 bg-dark-600/50 mx-1" />
          <ToolbarButton
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Маркированный список"
          >
            <List className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Нумерованный список"
          >
            <ListOrdered className="w-4 h-4" />
          </ToolbarButton>
          <div className="w-px h-5 bg-dark-600/50 mx-1" />
          <ToolbarButton
            active={editor.isActive('codeBlock')}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            title="Блок кода"
          >
            <Code2 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('link')}
            onClick={setLink}
            title="Ссылка"
          >
            <LinkIcon className="w-4 h-4" />
          </ToolbarButton>
          {onImageUpload && (
            <ToolbarButton onClick={handleImageUpload} title="Загрузить изображение">
              <ImageIcon className="w-4 h-4" />
            </ToolbarButton>
          )}
        </div>
      )}

      {/* Editor area */}
      <EditorContent
        editor={editor}
        className={[
          'px-4 py-3 text-white text-sm min-h-[200px]',
          // ProseMirror styling via Tailwind arbitrary selectors
          '[&_.ProseMirror]:outline-none',
          '[&_.ProseMirror]:min-h-[180px]',
          '[&_.ProseMirror_p]:mb-2',
          '[&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:text-white [&_.ProseMirror_h2]:mt-4 [&_.ProseMirror_h2]:mb-2',
          '[&_.ProseMirror_h3]:text-base [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:text-white [&_.ProseMirror_h3]:mt-3 [&_.ProseMirror_h3]:mb-1',
          '[&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_ul]:mb-2',
          '[&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_ol]:mb-2',
          '[&_.ProseMirror_li]:mb-1',
          '[&_.ProseMirror_pre]:bg-dark-800/80 [&_.ProseMirror_pre]:rounded-lg [&_.ProseMirror_pre]:p-3 [&_.ProseMirror_pre]:mb-2 [&_.ProseMirror_pre]:text-gray-300 [&_.ProseMirror_pre]:font-mono [&_.ProseMirror_pre]:text-xs',
          '[&_.ProseMirror_code]:bg-dark-800/50 [&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:px-1 [&_.ProseMirror_code]:text-accent-purple [&_.ProseMirror_code]:text-xs',
          '[&_.ProseMirror_img]:rounded-lg [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:my-2',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-gray-500 [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none',
        ].join(' ')}
      />

      {/* Hidden file input for image upload */}
      {onImageUpload && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={onFileSelected}
        />
      )}
    </div>
  )
}
