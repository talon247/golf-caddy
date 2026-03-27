import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Course, CourseHole } from '../types'
import { useCourseStore } from '../store'
import CourseForm from '../components/CourseForm'
import ConfirmModal from '../components/ConfirmModal'

type View = 'list' | 'create' | 'edit'

export default function Courses() {
  const navigate = useNavigate()
  const { courses, addCourse, updateCourse, deleteCourse } = useCourseStore()

  const [view, setView] = useState<View>('list')
  const [editing, setEditing] = useState<Course | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  function handleSaveNew(name: string, holes: CourseHole[]) {
    addCourse(name, holes)
    setView('list')
  }

  function handleSaveEdit(name: string, holes: CourseHole[]) {
    if (!editing) return
    updateCourse({ ...editing, name, holes })
    setEditing(null)
    setView('list')
  }

  function startEdit(course: Course) {
    setEditing(course)
    setView('edit')
  }

  function handleDelete(id: string) {
    deleteCourse(id)
    setConfirmDeleteId(null)
  }

  if (view === 'create') {
    return (
      <main className="flex flex-col flex-1 p-5 max-w-[390px] mx-auto w-full">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setView('list')}
            className="h-11 w-11 flex items-center justify-center rounded-full bg-[#faf7f2] border border-[#e5e1d8] text-[#1a1a1a]"
            aria-label="Back"
          >
            ‹
          </button>
          <h1 className="text-2xl font-bold text-[#1a1a1a]">New Course</h1>
        </div>
        <CourseForm onSave={handleSaveNew} onCancel={() => setView('list')} />
      </main>
    )
  }

  if (view === 'edit' && editing) {
    return (
      <main className="flex flex-col flex-1 p-5 max-w-[390px] mx-auto w-full">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => { setEditing(null); setView('list') }}
            className="h-11 w-11 flex items-center justify-center rounded-full bg-[#faf7f2] border border-[#e5e1d8] text-[#1a1a1a]"
            aria-label="Back"
          >
            ‹
          </button>
          <h1 className="text-2xl font-bold text-[#1a1a1a]">Edit Course</h1>
        </div>
        <CourseForm initial={editing} onSave={handleSaveEdit} onCancel={() => { setEditing(null); setView('list') }} />
      </main>
    )
  }

  return (
    <main className="flex flex-col flex-1 p-5 max-w-[390px] mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/')}
          className="h-11 w-11 flex items-center justify-center rounded-full bg-[#faf7f2] border border-[#e5e1d8] text-[#1a1a1a]"
          aria-label="Back"
        >
          ‹
        </button>
        <h1 className="text-2xl font-bold text-[#1a1a1a]">Saved Courses</h1>
      </div>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center py-16">
          <div className="text-5xl">⛳</div>
          <p className="text-gray-500 text-base">No saved courses yet.</p>
          <p className="text-gray-400 text-sm">Create a course to reuse its pars when starting a round.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3 mb-6">
          {courses.map(course => {
            const par = course.holes.reduce((s, h) => s + h.par, 0)
            return (
              <li
                key={course.id}
                className="bg-white border border-[#e5e1d8] rounded-2xl px-4 py-4 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-semibold text-[#1a1a1a]">{course.name}</div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {course.holes.length} holes · Par {par}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => startEdit(course)}
                    className="px-3 py-2 rounded-lg border border-[#e5e1d8] text-sm font-medium text-[#2d5a27] bg-white min-h-[40px]"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(course.id)}
                    className="px-3 py-2 rounded-lg border border-red-200 text-sm font-medium text-red-600 bg-white min-h-[40px]"
                  >
                    Delete
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <button
        onClick={() => setView('create')}
        className="w-full bg-[#2d5a27] text-white rounded-xl py-4 text-lg font-bold min-h-[56px]"
      >
        + New Course
      </button>

      {confirmDeleteId && (
        <ConfirmModal
          title="Delete course?"
          message="This will permanently remove the course. Past rounds using it are not affected."
          confirmLabel="Delete"
          cancelLabel="Keep"
          onConfirm={() => handleDelete(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </main>
  )
}
