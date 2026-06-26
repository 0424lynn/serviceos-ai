export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
              style={{ background: 'var(--brand)' }}
            >
              S
            </div>
            <span className="text-xl font-semibold text-gray-900">ServiceOS.ai</span>
          </div>
          <p className="text-sm text-gray-500">
            The AI Operating System for Service Teams
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
