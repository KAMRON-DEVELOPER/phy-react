import { Toaster } from 'sonner'
import { Player } from './Player'

function App() {
  return (
    <>
      <div>
        <Player />
      </div>
      <Toaster
        position="top-right"
        theme="dark"
        richColors={false}
        toastOptions={{
          classNames: {
            toast: 'toast-base',
            description: 'text-muted-foreground',
            info: 'toast-info',
            success: 'toast-success',
            warning: 'toast-warning',
            error: 'toast-error'
          }
        }}
      />
    </>
  )
}

export default App
