import { useParams } from 'react-router-dom'

export default function Summary() {
  const { id } = useParams<{ id: string }>()
  return (
    <main className="flex flex-col flex-1 p-6">
      <h1 className="text-2xl font-bold text-forest">Round Summary</h1>
      <p className="text-warm-gray mt-2">Round #{id}</p>
    </main>
  )
}
