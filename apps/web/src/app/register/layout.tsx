import Image from 'next/image'

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-2 justify-center">
            <Image src="/logo.png" alt="ServiceOS.ai" width={36} height={36} />
            <span className="text-xl font-semibold text-gray-900">ServiceOS.ai</span>
          </div>
          <p className="text-sm text-gray-500">The AI Operating System for Service Teams</p>
        </div>
        {children}
      </div>
    </div>
  )
}
