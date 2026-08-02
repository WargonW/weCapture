import { useSearchParams } from 'react-router-dom'
import MainView from './views/MainView'
import CaptureView from './views/CaptureView'
import RecorderView from './views/RecorderView'
import ColorPickerView from './views/ColorPickerView'

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
    default:
      return <MainView />
  }
}

export default App
