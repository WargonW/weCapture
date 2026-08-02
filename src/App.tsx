import { useSearchParams } from 'react-router-dom'
import MainView from './views/MainView'
import CaptureView from './views/CaptureView'
import RecorderView from './views/RecorderView'
import ColorPickerView from './views/ColorPickerView'
import PinView from './views/PinView'

function App() {
  const [searchParams] = useSearchParams()
  const windowType = searchParams.get('window') ?? 'main'

  switch (windowType) {
    case 'capture':
      return <CaptureView />
    case 'recorder':
      return <RecorderView />
    case 'color-picker':
      return <ColorPickerView />
    case 'pin':
      return <PinView />
    default:
      return <MainView />
  }
}

export default App
