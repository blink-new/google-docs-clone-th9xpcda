import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Separator } from './ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Badge } from './ui/badge'
import { ScrollArea } from './ui/scroll-area'
import { Avatar, AvatarFallback } from './ui/avatar'
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
  MoreHorizontal,
  Palette,
  List,
  ListOrdered,
  Link,
  IndentIncrease,
  IndentDecrease,
  Strikethrough,
  Subscript,
  Superscript,
  Copy,
  Plus,
  X,
  Check,
  Clock,
  UserPlus,
  Settings
} from 'lucide-react'
import { blink } from '../blink/client'

interface DocumentEditorProps {
  documentId?: string
}

interface Comment {
  id: string
  documentId: string
  userId: string
  content: string
  positionStart: number
  positionEnd: number
  createdAt: string
  resolved: boolean
  user?: {
    email: string
    name?: string
  }
}

interface CollaborativeUser {
  userId: string
  metadata: {
    displayName: string
    email: string
    cursor?: number
  }
  lastSeen: number
}

export default function DocumentEditor({ documentId = 'doc-' + Date.now() }: DocumentEditorProps) {
  const [documentTitle, setDocumentTitle] = useState('Untitled document')
  const [documentContent, setDocumentContent] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [collaborators, setCollaborators] = useState<CollaborativeUser[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [selectedText, setSelectedText] = useState('')
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [sharePermission, setSharePermission] = useState<'view' | 'edit'>('view')

  const editorRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout>()

  // Font families and sizes
  const fontFamilies = [
    { value: 'Arial, sans-serif', label: 'Arial' },
    { value: 'Times New Roman, serif', label: 'Times New Roman' },
    { value: 'Calibri, sans-serif', label: 'Calibri' },
    { value: 'Helvetica, sans-serif', label: 'Helvetica' },
    { value: 'Georgia, serif', label: 'Georgia' },
    { value: 'Verdana, sans-serif', label: 'Verdana' },
    { value: 'Comic Sans MS, cursive', label: 'Comic Sans MS' }
  ]

  const fontSizes = ['8', '9', '10', '11', '12', '14', '16', '18', '24', '36', '48', '72']

  const textColors = [
    '#000000', '#e60000', '#ff9900', '#ffff00', '#008a00', '#0066cc', '#9933ff',
    '#ffffff', '#facccc', '#ffebcc', '#ffffcc', '#cce8cc', '#cce0f5', '#ebd6ff',
    '#bbbbbb', '#f06666', '#ffc266', '#ffff66', '#66b266', '#66a3e0', '#c285ff',
    '#888888', '#a10000', '#b26b00', '#b2b200', '#006100', '#0047b2', '#6b24b2',
    '#444444', '#5c0000', '#663d00', '#666600', '#003700', '#002966', '#3d1466'
  ]

  // Auth state management
  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
      setIsLoading(state.isLoading)
    })
    return unsubscribe
  }, [])

  // Load document data
  useEffect(() => {
    if (user && documentId) {
      loadDocument()
      loadComments()
      setupRealtime()
    }
  }, [user, documentId])

  // Auto-save document content
  useEffect(() => {
    if (user && documentContent && !isLoading) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveDocument()
      }, 1000) // Auto-save after 1 second of inactivity
    }
  }, [documentContent, user, isLoading])

  const loadDocument = async () => {
    try {
      const docs = await blink.db.documents.list({
        where: { id: documentId },
        limit: 1
      })
      if (docs.length > 0) {
        const doc = docs[0]
        setDocumentTitle(doc.title || 'Untitled document')
        setDocumentContent(doc.content || '')
        if (editorRef.current) {
          editorRef.current.innerHTML = doc.content || '<div>Start typing your document...</div>'
        }
      }
    } catch (error) {
      console.error('Failed to load document:', error)
    }
  }

  const loadComments = async () => {
    try {
      const commentsList = await blink.db.documentComments.list({
        where: { documentId: documentId },
        orderBy: { createdAt: 'desc' }
      })
      setComments(commentsList)
    } catch (error) {
      console.error('Failed to load comments:', error)
    }
  }

  const setupRealtime = async () => {
    if (!user) return

    try {
      const channel = blink.realtime.channel(`document-${documentId}`)
      
      await channel.subscribe({
        userId: user.id,
        metadata: {
          displayName: user.email?.split('@')[0] || 'Anonymous',
          email: user.email || '',
          cursor: 0
        }
      })

      // Listen for content changes from other users
      channel.onMessage((message) => {
        if (message.type === 'content-update' && message.userId !== user.id) {
          if (editorRef.current && message.data.content) {
            // Update content but preserve cursor position
            const selection = window.getSelection()
            const range = selection?.getRangeAt(0)
            const startOffset = range?.startOffset || 0
            
            editorRef.current.innerHTML = message.data.content
            setDocumentContent(message.data.content)
            
            // Restore cursor position (simplified)
            try {
              if (range && editorRef.current.firstChild) {
                range.setStart(editorRef.current.firstChild, Math.min(startOffset, editorRef.current.textContent?.length || 0))
                range.collapse(true)
                selection?.removeAllRanges()
                selection?.addRange(range)
              }
            } catch (e) {
              // Ignore cursor restoration errors
            }
          }
        }
        
        if (message.type === 'title-update' && message.userId !== user.id) {
          setDocumentTitle(message.data.title)
        }

        if (message.type === 'comment-added') {
          setComments(prev => [message.data.comment, ...prev])
        }
      })

      // Listen for presence changes
      channel.onPresence((users) => {
        setCollaborators(users.filter(u => u.userId !== user.id))
      })

    } catch (error) {
      console.error('Failed to setup realtime:', error)
    }
  }

  const saveDocument = async () => {
    if (!user || isSaving) return
    
    setIsSaving(true)
    try {
      await blink.db.documents.upsert({
        id: documentId,
        title: documentTitle,
        content: documentContent,
        userId: user.id,
        updatedAt: new Date()
      })
      setLastSaved(new Date())

      // Broadcast content update to other users
      await blink.realtime.publish(`document-${documentId}`, 'content-update', {
        content: documentContent,
        updatedBy: user.id
      })
    } catch (error) {
      console.error('Failed to save document:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleTitleEdit = () => {
    setIsEditing(true)
    setTimeout(() => titleRef.current?.focus(), 0)
  }

  const handleTitleSave = async () => {
    setIsEditing(false)
    if (user) {
      try {
        await blink.db.documents.upsert({
          id: documentId,
          title: documentTitle,
          userId: user.id,
          updatedAt: new Date()
        })

        // Broadcast title update
        await blink.realtime.publish(`document-${documentId}`, 'title-update', {
          title: documentTitle,
          updatedBy: user.id
        })
      } catch (error) {
        console.error('Failed to save title:', error)
      }
    }
  }

  const formatText = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
    handleContentChange()
  }

  const handleContentChange = () => {
    if (editorRef.current) {
      const content = editorRef.current.innerHTML
      setDocumentContent(content)
    }
  }

  const handleTextSelection = () => {
    const selection = window.getSelection()
    if (selection && selection.toString().trim()) {
      setSelectedText(selection.toString().trim())
    } else {
      setSelectedText('')
    }
  }

  const addComment = async () => {
    if (!selectedText || !user) return

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    const startOffset = range.startOffset
    const endOffset = range.endOffset

    const commentContent = prompt('Add a comment:')
    if (!commentContent) return

    try {
      const comment = {
        id: 'comment-' + Date.now(),
        documentId,
        userId: user.id,
        content: commentContent,
        positionStart: startOffset,
        positionEnd: endOffset,
        createdAt: new Date().toISOString(),
        resolved: false
      }

      await blink.db.documentComments.create(comment)
      setComments(prev => [{ ...comment, user: { email: user.email } }, ...prev])

      // Broadcast new comment
      await blink.realtime.publish(`document-${documentId}`, 'comment-added', {
        comment: { ...comment, user: { email: user.email } }
      })

      setSelectedText('')
    } catch (error) {
      console.error('Failed to add comment:', error)
    }
  }

  const shareDocument = async () => {
    if (!shareEmail || !user) return

    try {
      await blink.db.documentCollaborators.create({
        id: 'collab-' + Date.now(),
        documentId,
        userId: shareEmail, // In real app, this would be resolved to actual user ID
        permission: sharePermission
      })

      setShareEmail('')
      setIsShareDialogOpen(false)
      // You could show a success toast here
    } catch (error) {
      console.error('Failed to share document:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="h-screen bg-[#f9fbfd] flex items-center justify-center w-full">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#1a73e8] rounded-lg flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white text-2xl font-bold">D</span>
          </div>
          <h2 className="text-2xl font-normal text-gray-900 mb-2">Loading...</h2>
          <p className="text-gray-600">Please wait while we load your document</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="h-screen bg-[#f9fbfd] flex items-center justify-center w-full">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#1a73e8] rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">D</span>
          </div>
          <h2 className="text-2xl font-normal text-gray-900 mb-2">Google Docs</h2>
          <p className="text-gray-600 mb-4">Please sign in to continue</p>
          <Button onClick={() => blink.auth.login()} className="bg-[#1a73e8] hover:bg-[#1557b0]">
            Sign In
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-[#f9fbfd] flex flex-col w-full">
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
              {/* Collaborators */}
              <div className="flex items-center space-x-2">
                {collaborators.slice(0, 3).map((collab, index) => (
                  <Avatar key={collab.userId} className="w-8 h-8 border-2 border-white" style={{ marginLeft: index > 0 ? '-8px' : '0' }}>
                    <AvatarFallback className="bg-green-500 text-white text-xs">
                      {collab.metadata.displayName?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {collaborators.length > 3 && (
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs text-gray-600 border-2 border-white" style={{ marginLeft: '-8px' }}>
                    +{collaborators.length - 3}
                  </div>
                )}
              </div>

              {/* Save status */}
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                {isSaving && (
                  <div className="flex items-center space-x-1">
                    <div className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span>Saving...</span>
                  </div>
                )}
                {lastSaved && !isSaving && (
                  <div className="flex items-center space-x-1">
                    <Check className="w-3 h-3 text-green-600" />
                    <span>Saved {lastSaved.toLocaleTimeString()}</span>
                  </div>
                )}
              </div>

              <Button variant="ghost" size="sm" className="text-gray-700 px-3 py-1.5 h-8">
                <Eye className="w-4 h-4 mr-1.5" />
                <span className="text-sm">Editing</span>
                <ChevronDown className="w-3 h-3 ml-1.5" />
              </Button>
              
              <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-[#1a73e8] hover:bg-[#1557b0] text-white px-4 py-1.5 h-8 text-sm font-medium">
                    <Share2 className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Share "{documentTitle}"</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Email address</label>
                      <Input
                        placeholder="Enter email address"
                        value={shareEmail}
                        onChange={(e) => setShareEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Permission</label>
                      <Select value={sharePermission} onValueChange={(value: 'view' | 'edit') => setSharePermission(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="view">Can view</SelectItem>
                          <SelectItem value="edit">Can edit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={shareDocument} className="w-full">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Share
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

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

          {/* Enhanced Formatting toolbar */}
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
              <Select onValueChange={(value) => formatText('formatBlock', value)}>
                <SelectTrigger className="w-32 h-8 text-sm">
                  <SelectValue placeholder="Normal text" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="div">Normal text</SelectItem>
                  <SelectItem value="h1">Heading 1</SelectItem>
                  <SelectItem value="h2">Heading 2</SelectItem>
                  <SelectItem value="h3">Heading 3</SelectItem>
                  <SelectItem value="h4">Heading 4</SelectItem>
                  <SelectItem value="h5">Heading 5</SelectItem>
                  <SelectItem value="h6">Heading 6</SelectItem>
                </SelectContent>
              </Select>
              
              <Select onValueChange={(value) => formatText('fontName', value)}>
                <SelectTrigger className="w-28 h-8 text-sm">
                  <SelectValue placeholder="Arial" />
                </SelectTrigger>
                <SelectContent>
                  {fontFamilies.map((font) => (
                    <SelectItem key={font.value} value={font.value}>{font.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select onValueChange={(value) => formatText('fontSize', value)}>
                <SelectTrigger className="w-16 h-8 text-sm">
                  <SelectValue placeholder="11" />
                </SelectTrigger>
                <SelectContent>
                  {fontSizes.map((size) => (
                    <SelectItem key={size} value={size}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => formatText('strikeThrough')}
                className="h-8 w-8 p-0 hover:bg-gray-100"
              >
                <Strikethrough className="w-4 h-4" />
              </Button>
            </div>

            {/* Text color */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-gray-100">
                  <Palette className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48">
                <div className="grid grid-cols-7 gap-1">
                  {textColors.map((color) => (
                    <button
                      key={color}
                      className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                      onClick={() => formatText('foreColor', color)}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Separator orientation="vertical" className="h-6 mx-2" />

            {/* Lists */}
            <div className="flex items-center">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => formatText('insertUnorderedList')}
                className="h-8 w-8 p-0 hover:bg-gray-100"
              >
                <List className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => formatText('insertOrderedList')}
                className="h-8 w-8 p-0 hover:bg-gray-100"
              >
                <ListOrdered className="w-4 h-4" />
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
              {selectedText && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={addComment}
                  className="h-8 px-3 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100"
                >
                  <MessageSquare className="w-4 h-4 mr-1" />
                  Comment
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Link className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 overflow-auto bg-[#f9fbfd] custom-scrollbar">
        <div className="flex">
          {/* Document content */}
          <div className="flex-1 flex justify-center pt-6 pb-12">
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
                  onMouseUp={handleTextSelection}
                  onKeyUp={handleTextSelection}
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

          {/* Comments sidebar */}
          {comments.length > 0 && (
            <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-medium text-gray-900 flex items-center">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Comments ({comments.length})
                </h3>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">
                            {comment.user?.email?.[0]?.toUpperCase() || 'U'}
                          </div>
                          <span className="text-sm font-medium">{comment.user?.email?.split('@')[0] || 'Anonymous'}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{comment.content}</p>
                      {!comment.resolved && (
                        <div className="mt-2 flex justify-end">
                          <Button size="sm" variant="outline" className="h-6 text-xs">
                            Resolve
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}