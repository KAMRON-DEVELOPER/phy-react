import { Toaster } from 'sonner'
import { Player } from './Player'

function App() {
  return (
    <main className="h-screen w-screen bg-[#16161A] p-6 text-[#DFDFD6]">
      <Player />
      <Toaster
        position="top-right"
        theme="dark"
        richColors={false}
        toastOptions={{
          classNames: {
            toast: '!bg-[#16161A] !text-[#DFDFD6] !border !border-[#FF45AC]/20 !shadow-none',
            description: '!text-[#DFDFD6]/60',
            info: '!border-[#FF45AC]/30',
            success: '!border-green-500/30',
            warning: '!border-yellow-500/30',
            error: '!border-red-500/30'
          }
        }}
      />
    </main>
  )
}

export default App
