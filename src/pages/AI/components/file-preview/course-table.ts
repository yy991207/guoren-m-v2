type CourseTableCourse = {
  resource_id: string
  title: string
  duration: number
}

export type CourseTableArtifact = {
  type: 'course_table'
  query: string
  total_duration: number
  courses: CourseTableCourse[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeParsedCourseTable(parsedValue: unknown): CourseTableArtifact | null {
  try {
    if (!isRecord(parsedValue)) {
      return null
    }

    if (parsedValue.type !== 'course_table') {
      return null
    }

    const query = readString(parsedValue.query)
    const totalDuration = readNumber(parsedValue.total_duration)

    if (!query || totalDuration === null || !Array.isArray(parsedValue.courses)) {
      return null
    }

    const courses = parsedValue.courses.flatMap((item) => {
      if (!isRecord(item)) {
        return []
      }

      const resourceId = readString(item.resource_id)
      const title = readString(item.title)
      const duration = readNumber(item.duration)

      if (!resourceId || !title || duration === null) {
        return []
      }

      return [{
        resource_id: resourceId,
        title,
        duration,
      }]
    })

    if (!courses.length) {
      return null
    }

    return {
      type: 'course_table',
      query,
      total_duration: totalDuration,
      courses,
    }
  } catch {
    return null
  }
}

// 仅识别课程表 JSON；不猜测损坏的内容，仍可在预览里阅读原文。
export function parseCourseTableArtifact(content: string): CourseTableArtifact | null {
  try {
    return normalizeParsedCourseTable(JSON.parse(content))
  } catch {
    return null
  }
}
