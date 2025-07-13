import React, { useState, useRef, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Separator } from './ui/separator'
import { 
  Bold, 
  Italic, 
  Underline, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  AlignJustify,
  ChevronDown,
  Share2,
  Star,
  Folder,
  Users,
  MessageSquare,
  Undo,
  Redo,
  Printer,
  Eye,
  MoreHorizontal
} from 'lucide-react'
import { blink } from '../blink/client'

interface DocumentEditorProps {
  documentId?: string
}

export default function DocumentEditor({ documentId = 'untitled' }: DocumentEditorProps) {
  const [documentTitle, setDocumentTitle] = useState('Untitled document')
  const [documentContent, setDocumentContent] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [user, setUser] = useState<any>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  // Auth state management
  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
    })
    return unsubscribe
  }, [])

  const handleTitleEdit = () => {
    setIsEditing(true)
    setTimeout(() => titleRef.current?.focus(), 0)
  }

  const handleTitleSave = () => {
    setIsEditing(false)
    // Auto-save title
    saveTitleToDatabase()
  }

  const saveTitleToDatabase = async () => {
    if (!user) return
    try {
      await blink.db.documents.upsert({
        id: documentId,
        title: documentTitle,
        userId: user.id,
        updatedAt: new Date()
      })
    } catch (error) {
      console.error('Failed to save title:', error)
    }
  }

  const formatText = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
  }

  const handleContentChange = () => {
    if (editorRef.current) {
      const content = editorRef.current.innerHTML
      setDocumentContent(content)
      // Debounced auto-save would go here
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f9fbfd] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#1a73e8] rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">D</span>
          </div>
          <h2 className="text-2xl font-normal text-gray-900 mb-2">Google Docs</h2>
          <p className="text-gray-600">Please sign in to continue</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f9fbfd] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="px-6 py-3">
          {/* Top row - Logo and main controls */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              {/* Logo and brand */}
              <div className="flex items-center mr-6">
                <div className="w-10 h-10 bg-[#1a73e8] rounded-lg flex items-center justify-center mr-3">
                  <span className="text-white text-lg font-bold">D</span>
                </div>
                <span className="text-gray-700 text-xl font-normal">Docs</span>
              </div>
              
              {/* Document title section */}
              <div className="flex items-center space-x-1">
                {isEditing ? (
                  <Input
                    ref={titleRef}
                    value={documentTitle}
                    onChange={(e) => setDocumentTitle(e.target.value)}
                    onBlur={handleTitleSave}
                    onKeyPress={(e) => e.key === 'Enter' && handleTitleSave()}
                    className="text-lg font-normal border-none shadow-none focus-visible:ring-1 focus-visible:ring-blue-500 px-2 py-1 h-8"
                  />
                ) : (
                  <h1 
                    className="text-lg font-normal text-gray-800 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded-md transition-colors"
                    onClick={handleTitleEdit}
                  >
                    {documentTitle}
                  </h1>
                )}
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <Star className="w-4 h-4 text-gray-600" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <Folder className="w-4 h-4 text-gray-600" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="w-4 h-4 text-gray-600" />
                </Button>
              </div>
            </div>

            {/* Right side controls */}
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" className="text-gray-700 px-3 py-1.5 h-8">
                <Eye className="w-4 h-4 mr-1.5" />
                <span className="text-sm">Editing</span>
                <ChevronDown className="w-3 h-3 ml-1.5" />
              </Button>
              <Button className="bg-[#1a73e8] hover:bg-[#1557b0] text-white px-4 py-1.5 h-8 text-sm font-medium">
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
              <div className="w-8 h-8 bg-[#34a853] rounded-full flex items-center justify-center text-white text-sm font-medium">
                {user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
            </div>
          </div>

          {/* Menu bar */}
          <div className="flex items-center space-x-4 text-sm text-gray-700 mb-3">
            <button className="hover:bg-gray-100 px-3 py-1.5 rounded-md transition-colors">File</button>
            <button className="hover:bg-gray-100 px-3 py-1.5 rounded-md transition-colors">Edit</button>
            <button className="hover:bg-gray-100 px-3 py-1.5 rounded-md transition-colors">View</button>
            <button className="hover:bg-gray-100 px-3 py-1.5 rounded-md transition-colors">Insert</button>
            <button className="hover:bg-gray-100 px-3 py-1.5 rounded-md transition-colors">Format</button>
            <button className="hover:bg-gray-100 px-3 py-1.5 rounded-md transition-colors">Tools</button>
            <button className="hover:bg-gray-100 px-3 py-1.5 rounded-md transition-colors">Extensions</button>
            <button className="hover:bg-gray-100 px-3 py-1.5 rounded-md transition-colors">Help</button>
          </div>

          {/* Formatting toolbar */}
          <div className="flex items-center space-x-1 py-2 border-t border-gray-200 pt-3">
            {/* Undo/Redo group */}
            <div className="flex items-center">
              <Button variant="ghost" size="sm" onClick={() => formatText('undo')} className="h-8 w-8 p-0">
                <Undo className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => formatText('redo')} className="h-8 w-8 p-0">
                <Redo className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Printer className="w-4 h-4" />
              </Button>
            </div>
            
            <Separator orientation="vertical" className="h-6 mx-2" />
            
            {/* Text formatting dropdowns */}
            <div className="flex items-center space-x-2">
              <select className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-[120px]">
                <option>Normal text</option>
                <option>Heading 1</option>
                <option>Heading 2</option>
                <option>Heading 3</option>
                <option>Heading 4</option>
                <option>Heading 5</option>
                <option>Heading 6</option>
              </select>
              
              <select className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-[100px]">
                <option>Arial</option>
                <option>Times New Roman</option>
                <option>Calibri</option>
                <option>Helvetica</option>
                <option>Georgia</option>
              </select>
              
              <select className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 w-16">
                <option>8</option>
                <option>9</option>
                <option>10</option>
                <option>11</option>
                <option>12</option>
                <option>14</option>
                <option>18</option>
                <option>24</option>
                <option>36</option>
              </select>
            </div>

            <Separator orientation="vertical" className="h-6 mx-2" />

            {/* Text style buttons */}
            <div className="flex items-center">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => formatText('bold')}
                className="h-8 w-8 p-0 hover:bg-gray-100"
              >
                <Bold className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => formatText('italic')}
                className="h-8 w-8 p-0 hover:bg-gray-100"
              >
                <Italic className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => formatText('underline')}
                className="h-8 w-8 p-0 hover:bg-gray-100"
              >
                <Underline className="w-4 h-4" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-6 mx-2" />

            {/* Alignment buttons */}
            <div className="flex items-center">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => formatText('justifyLeft')}
                className="h-8 w-8 p-0 hover:bg-gray-100"
              >
                <AlignLeft className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => formatText('justifyCenter')}
                className="h-8 w-8 p-0 hover:bg-gray-100"
              >
                <AlignCenter className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => formatText('justifyRight')}
                className="h-8 w-8 p-0 hover:bg-gray-100"
              >
                <AlignRight className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => formatText('justifyFull')}
                className="h-8 w-8 p-0 hover:bg-gray-100"
              >
                <AlignJustify className="w-4 h-4" />
              </Button>
            </div>

            {/* Right side toolbar items */}
            <div className="ml-auto flex items-center space-x-1">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MessageSquare className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Users className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 overflow-auto bg-[#f9fbfd] custom-scrollbar">
        <div className="flex justify-center pt-6 pb-12">
          {/* Document canvas container */}
          <div className="w-full max-w-[8.5in] px-6">
            {/* Document paper */}
            <div 
              className="bg-white document-shadow rounded-sm mx-auto transition-smooth"
              style={{ 
                width: '8.5in',
                minHeight: '11in',
                maxWidth: '100%'
              }}
            >
              {/* Ruler */}
              <div className="h-6 bg-gray-50 border-b border-gray-200 relative overflow-hidden">
                <div className="absolute inset-0 flex items-end px-16">
                  {Array.from({ length: 17 }, (_, i) => (
                    <div key={i} className="flex-1 relative">
                      <div className="absolute right-0 bottom-0 w-px h-2 bg-gray-300"></div>
                      {i % 4 === 0 && (
                        <div className="absolute right-0 bottom-0 w-px h-3 bg-gray-500"></div>
                      )}
                      {i % 8 === 0 && i > 0 && (
                        <span className="absolute -right-2 bottom-4 text-xs text-gray-500 text-center w-4">
                          {i / 4}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Document content area */}
              <div 
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleContentChange}
                className="px-16 py-16 min-h-[10.5in] outline-none text-gray-900 leading-relaxed focus:outline-none"
                style={{ 
                  fontSize: '11pt',
                  fontFamily: 'Arial, sans-serif',
                  lineHeight: '1.6'
                }}
                data-placeholder="Start typing your document..."
              >
                <div className="text-gray-400">Start typing your document...</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}