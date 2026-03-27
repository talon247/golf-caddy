import { create } from 'zustand'
import type { Course, CourseHole } from '../types'
import { loadCourses, saveCourses } from '../storage'

interface CourseStore {
  courses: Course[]
  addCourse: (name: string, holes: CourseHole[]) => Course
  updateCourse: (course: Course) => void
  deleteCourse: (id: string) => void
}

export const useCourseStore = create<CourseStore>((set, get) => ({
  courses: loadCourses(),

  addCourse: (name, holes) => {
    const course: Course = {
      id: crypto.randomUUID(),
      name,
      holes,
      createdAt: new Date().toISOString(),
    }
    const courses = [...get().courses, course]
    set({ courses })
    saveCourses(courses)
    return course
  },

  updateCourse: (course) => {
    const courses = get().courses.map(c => (c.id === course.id ? course : c))
    set({ courses })
    saveCourses(courses)
  },

  deleteCourse: (id) => {
    const courses = get().courses.filter(c => c.id !== id)
    set({ courses })
    saveCourses(courses)
  },
}))
