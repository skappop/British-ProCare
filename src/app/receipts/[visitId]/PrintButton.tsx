'use client'

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="text-sm px-4 py-2 rounded-md bg-gray-900 hover:bg-gray-700 text-white transition-colors"
    >
      Print / Save as PDF
    </button>
  )
}
